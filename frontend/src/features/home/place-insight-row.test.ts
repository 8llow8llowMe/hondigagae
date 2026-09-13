import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PlaceInsightRow } from '@/features/home/place-insight-row'
import { messages } from '@/lib/messages'
import { suitability, suitabilityInsufficient } from '@/test/fixtures/insight'
import { placeSummary } from '@/test/fixtures/place'
import type { CongestionItem, PlaceSuitabilityResponse } from '@/types/insight'
import type { PlaceSummary } from '@/types/place'

function render(data: PlaceSuitabilityResponse) {
  return renderToStaticMarkup(createElement(PlaceInsightRow, { data, place: placeSummary }))
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
        reasons: [],
      }),
    )

    expect(markup).toContain(suitability.placeTitle)
    expect(markup).not.toContain('최고기온 31도')
  })
})

/*
  #307 — 홈 첫 화면에 값이 너무 많이 서 있어 "요약" 이 아니라 "짧은 목록" 이 됐다.
  `DESIGN.md` §1 — 위계는 크기와 순서로 만들고, **낮은 우선순위는 접는다.**
*/
describe('PlaceInsightRow — 접힘', () => {
  const data = { ...suitability, reasons: REASONS_WITHOUT_CONGESTION }

  function collapsed() {
    return renderToStaticMarkup(
      createElement(PlaceInsightRow, { data, place: placeSummary, collapsed: true }),
    )
  }

  it('접히면 근거를 그리지 않는다', () => {
    expect(collapsed()).not.toContain('최고기온 31도')
    expect(render(data)).toContain('최고기온 31도')
  })

  it('접혀도 이름 · 등급 배지 · 점수는 남는다', () => {
    const markup = collapsed()

    expect(markup).toContain(suitability.placeTitle)
    expect(markup).toContain(suitability.suitabilityLevel.name)
    expect(markup).toContain(String(suitability.score))
  })

  /*
    **점수 크기가 위계다.** 색으로 만들지 않으므로(§1) 등급 색은 접힌 행에도 그대로 있고,
    갈리는 것은 `text-display`(28/900) 대 `text-title-1`(22/900) 뿐이다 (§3-3 — 그 사이 크기는 없다).
  */
  it('접힌 행의 점수는 한 단계 작다', () => {
    expect(render(data)).toContain('text-display')
    /*
      **`not.toContain` 쪽이 본 단언이다** (#530). 접은 모양의 판정 묶음이 늘 `row`(22/900)
      라, `toContain('text-title-1')` 만으로는 넓은 행의 점수 열이 `hero` 로 되돌아가도
      통과한다 — 접힌 행에 `text-display` 가 **없다**는 것이 위계를 지키는 조건이다.
    */
    expect(collapsed()).toContain('text-title-1')
    expect(collapsed()).not.toContain('text-display')
  })

  /*
    **행 높이를 96px 썸네일이 잡고 있다** — #304 계측에서 근거 두 줄을 걷어도 136px 그대로였다.
    썸네일을 함께 줄이지 않으면 접기가 높이를 못 줄인다.
  */
  it('접힌 행은 데스크톱 썸네일이 48px 이다', () => {
    expect(collapsed()).toContain('md:size-12')
    expect(render(data)).toContain('md:size-24')
  })

  /*
    **모바일 출력은 접기 전과 같아야 한다.** 접는 것(근거 · 속성 태그)이 애초에 `md:`
    전용이라 모바일에는 접을 것이 없고, 390px 에서 썸네일까지 줄이면 목록을 알아보는
    유일한 단서를 가장 좁은 화면에서 뺏게 된다.
  */
  it('모바일 썸네일 크기는 건드리지 않는다', () => {
    expect(collapsed()).toContain('size-20')
  })
})

/*
  #530 — 고정 열 둘(태그 144 · 판정 112)이 `md:`(뷰포트)로 켜져 있어 **768 에서 본문에
  200px 대만 남았고**, 1024 의 우측 열에서는 76px 이었다. 뷰포트는 행이 실제로 받은 폭을
  모른다 — `place-row.tsx` 가 같은 이유로 이미 `@container` 를 쓰고 있다.
*/
describe('PlaceInsightRow — 컨테이너 쿼리로 접는 행 (#530)', () => {
  const markup = render({ ...suitability, reasons: REASONS_WITHOUT_CONGESTION })

  /** 접힌 행. 혼잡도가 실제로 온 날이라야 "혼잡도만 남는다" 를 볼 수 있다 */
  function collapsedNarrow() {
    return renderToStaticMarkup(
      createElement(PlaceInsightRow, {
        data: { ...suitability, congestion: CROWDED, reasons: REASONS_WITHOUT_CONGESTION },
        place: placeSummary,
        collapsed: true,
      }),
    )
  }

  it('행이 자기 폭을 재는 컨테이너가 된다', () => {
    expect(markup).toContain('@container')
  })

  /*
    **고정 열 둘은 컨테이너 축에서만 선다.** `md:flex` 로 되돌리면 1024 의 우측 열처럼
    좁은 컨테이너에서 본문이 다시 눌린다.
  */
  it('고정 열 둘이 뷰포트가 아니라 컨테이너 폭으로 켜진다', () => {
    expect(markup).toContain('@2xl:flex')
    expect(markup).not.toContain('md:flex')
  })

  /* 좁은 행에서는 그 두 열이 아예 자리를 내지 않는다 */
  it('좁은 행에서는 고정 열 둘이 숨는다', () => {
    expect(markup).toContain('hidden w-36')
    expect(markup).toContain('hidden w-28')
  })

  /*
    **등급 배지와 점수를 제목 줄 오른쪽에 합친다.** 예전에는 배지만 제목 옆에 서고 점수는
    메타 아래 제 줄을 따로 썼다 — 같은 판정을 두 해상도로 말하는 값이라 붙어 있어야 하고,
    붙이면 행이 한 줄 짧아진다.
  */
  it('접은 모양은 등급 배지와 점수가 한 묶음이다', () => {
    expect(markup).toContain('@2xl:hidden')
    // 넓은 행으로 켜질 때 이 묶음이 사라져야 배지·점수가 두 번 보이지 않는다
    expect(markup.match(/@2xl:hidden/g)?.length).toBeGreaterThanOrEqual(2)
  })

  /*
    **DOM 순서는 제목 → 메타 → 태그 그대로다** — 시각 순서만 `order-first` 로 바꾼다.
    스크린리더는 이름을 먼저 읽는다 (`place-row.tsx` 와 같은 규약).
  */
  it('태그는 제목 위로 올리되 DOM 에서는 메타 뒤에 남는다', () => {
    expect(markup).toContain('order-first')
    expect(markup.indexOf(suitability.placeTitle)).toBeLessThan(markup.indexOf('order-first'))
  })

  /*
    **접힌 행은 속성 태그를 달지 않는다** — 동반 가능 여부 · 실내/야외는 안 바뀌는 값이라
    상세에서 읽으면 되고, 세 행에 같은 무게로 서면 위계가 안 읽힌다.
  */
  it('접힌 행은 좁은 행에서도 속성 태그를 달지 않는다', () => {
    /*
      **태그 줄만 떼어내 본다.** `실내` 는 바로 위 메타 줄(`제주시 한림읍 · 실내`)에도
      있어서 마크업 전체에 `not.toContain` 을 걸면 속성 태그가 아니라 메타를 잡는다.
    */
    const tags = /order-first[^"]*">(.*?)<\/div>/.exec(collapsedNarrow())?.[1] ?? ''

    expect(tags).not.toContain(placeSummary.petAllowanceType.name)
    expect(tags).not.toContain(messages.home.indoor)
    expect(tags).toContain(CROWDED.level.name)
  })

  /*
    **혼잡도는 접지 않는다.** 섹션 부제가 "날씨·혼잡도 반영" 이라고 말하는 값이라
    2·3등에서 지우면 그 문장이 화면에서 근거를 잃는다 — `CongestionBadge` 가 생긴 이유다.
  */
  it('접힌 행에도 혼잡도 배지는 남는다', () => {
    const markup = collapsedNarrow()

    expect(markup).toContain(CROWDED.level.name)
    // 태그 줄 자체는 서므로 제목 위 자리도 그대로다
    expect(markup).toContain('order-first')
  })

  /* 그릴 것이 혼잡도뿐인데 그마저 없으면 태그 줄을 만들지 않는다 */
  it('접힌 행에 혼잡도가 없으면 태그 줄을 만들지 않는다', () => {
    const markup = renderToStaticMarkup(
      createElement(PlaceInsightRow, {
        data: { ...suitability, congestion: null, reasons: REASONS_WITHOUT_CONGESTION },
        place: placeSummary,
        collapsed: true,
      }),
    )

    expect(markup).not.toContain('order-first')
  })
})

/*
  #530 — 동반 정보가 없는 장소가 서버 `name` 그대로 `정보 없음` 배지를 달고 `야외` ·
  `혼잡도 정보 없음` 옆에 섰다. 낱말을 갖고 있는 이웃 때문에 **무엇의 정보가 없다는
  것인지** 더 안 읽혔다.
*/
describe('PlaceInsightRow — 동반 정보 없음 (#530)', () => {
  const unknownAllowance: PlaceSummary = {
    ...placeSummary,
    petAllowanceType: { code: 'UNKNOWN', name: '정보 없음', description: null },
  }

  function withPlace(place: PlaceSummary) {
    return renderToStaticMarkup(
      createElement(PlaceInsightRow, {
        data: { ...suitability, congestion: CROWDED, reasons: REASONS_WITHOUT_CONGESTION },
        place,
      }),
    )
  }

  it('UNKNOWN 이면 동반 배지를 그리지 않는다', () => {
    expect(withPlace(unknownAllowance)).not.toContain('정보 없음')
  })

  /* 판정한 장소는 그대로다 — 거르는 것은 `UNKNOWN` 하나뿐이다 */
  it('판정이 있는 장소의 동반 배지는 서버 문구 그대로 남는다', () => {
    expect(withPlace(placeSummary)).toContain(placeSummary.petAllowanceType.name)
  })

  /*
    **문구가 아니라 `code` 로 거른다.** `name` 은 서버 문구라 언제든 바뀌고, 문구 비교는
    그때 조용히 어긋난다 (api-integration-guide.md §6).
  */
  it('같은 문구라도 code 가 다르면 그린다', () => {
    const sameWording: PlaceSummary = {
      ...placeSummary,
      petAllowanceType: { code: 'NOT_ALLOWED', name: '정보 없음', description: null },
    }

    expect(withPlace(sameWording)).toContain('정보 없음')
  })

  /* 동반 배지만 빠진다 — 같은 줄의 실내/야외 · 혼잡도는 그대로다 */
  it('옆 태그는 함께 사라지지 않는다', () => {
    const markup = withPlace(unknownAllowance)

    expect(markup).toContain(messages.home.indoor)
    expect(markup).toContain(CROWDED.level.name)
  })

  /*
    **셋 다 없으면 태그 묶음 자체를 내지 않는다.** 빈 `div` 를 남기면 `order-first mb-1.5`
    만 남아 제목 위에 6px 이 뜬다.
  */
  it('그릴 태그가 하나도 없으면 묶음을 만들지 않는다', () => {
    const markup = renderToStaticMarkup(
      createElement(PlaceInsightRow, {
        data: { ...suitability, congestion: null, reasons: REASONS_WITHOUT_CONGESTION },
        place: { ...unknownAllowance, indoor: null },
      }),
    )

    expect(markup).not.toContain('order-first')
  })
})

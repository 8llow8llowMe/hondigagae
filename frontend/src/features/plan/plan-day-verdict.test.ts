import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PlanDayVerdict } from '@/features/plan/plan-day-verdict'
import { messages } from '@/lib/messages'
import { planVerdict } from '@/test/fixtures/plan'
import type { PlanDailyWeatherItem, PlanDayWeatherItem } from '@/types/plan'

function weather(overrides: Partial<PlanDailyWeatherItem>): PlanDailyWeatherItem {
  if (planVerdict.weather === null) throw new Error('fixture 에 예보가 있어야 한다')
  return { ...planVerdict.weather, ...overrides }
}

function render(
  overrides: Partial<PlanDayWeatherItem> = {},
  extra: { dayHasItems?: boolean } = {},
) {
  return renderToStaticMarkup(
    createElement(PlanDayVerdict, {
      verdict: { ...planVerdict, ...overrides },
      petConditionApplied: true,
      basisPetName: null,
      failed: false,
      onRetry: () => undefined,
      dayHasItems: true,
      ...extra,
    }),
  )
}

/* 일정 화면의 등급어도 같은 축 어휘를 쓴다 — 화면마다 갈리면 배운 규칙이 깨진다 (#652) */
describe('PlanDayVerdict — 판정이 축을 밝힌다 (#652 · #856)', () => {
  /*
    **축 이름이 배지 접두어에서 캡션으로 옮겼다** (#856). 배지를 걷고 등급어를 `MetricWord`
    로 올리면서 `axis` 접두어가 하던 일을 이 캡션이 맡는다 — 좌 레일 목차가 섹션 머리에
    맡긴 것과 같은 방식이다. **무엇이 그리든 축은 화면에 남아야 한다**: 떼면 `보통` 이
    혼잡도의 `보통` 과 구분되지 않는다.
  */
  it('판정이 적합도 축임을 말한다', () => {
    const html = render()
    const axis = messages.common.metricAxisSuitability

    expect(html).toContain(`>${axis}</span>`)
    expect(html).toContain(`>${planVerdict.suitabilityLevel?.name}</span>`)
  })

  /* 등급어는 서버 값 그대로다 — 라벨이 어휘를 다시 쓰는 일이 되면 안 된다 */
  it('축 라벨과 등급어가 한 문자열로 붙지 않는다', () => {
    expect(render()).not.toContain(
      `${messages.common.metricAxisSuitability} ${planVerdict.suitabilityLevel?.name}`,
    )
  })

  /*
    **등급어와 축 캡션이 다른 줄에 선다** (#856) — 캡션이 위, 등급어가 아래인 한 기둥이다.
    오른쪽 온도 기둥도 `캡션 + 값` 이라 좌우가 같은 리듬을 갖는다.
  */
  it('축 캡션이 등급어보다 앞에 온다', () => {
    const html = render()
    const axis = html.indexOf(`>${messages.common.metricAxisSuitability}</span>`)
    const word = html.indexOf(`>${planVerdict.suitabilityLevel?.name}</span>`)

    expect(axis).toBeGreaterThan(-1)
    expect(axis).toBeLessThan(word)
  })
})

/*
  일자 판정은 그날 순서가 가장 앞선 장소 하나의 판정이다 (`pickRepresentative`). 이름을 밝히지
  않으면 그 장소의 사정(`소형견만 가능` · 추가 요금)이 하루 전체의 판정으로 읽힌다.
*/
describe('PlanDayVerdict — 기준 장소를 밝힌다', () => {
  it('판정을 낸 장소 이름을 축 캡션 옆에 붙인다', () => {
    const html = render({ representativePlaceTitle: '포시즌펜션' })

    expect(html).toContain(messages.plan.verdictBasisPlace.replace('{title}', '포시즌펜션'))
  })

  it('기준 장소가 축 캡션보다 뒤, 등급어보다 앞에 온다 — 근거를 읽기 전에 안다', () => {
    const html = render({ representativePlaceTitle: '포시즌펜션' })
    const axis = html.indexOf(`>${messages.common.metricAxisSuitability}</span>`)
    const place = html.indexOf('포시즌펜션')
    const word = html.indexOf(`>${planVerdict.suitabilityLevel?.name}</span>`)

    expect(axis).toBeLessThan(place)
    expect(place).toBeLessThan(word)
  })

  it('기준 장소가 없으면 축 캡션만 선다 — 빈 `기준` 을 남기지 않는다', () => {
    const html = render({ representativePlaceTitle: null })

    expect(html).not.toContain(messages.plan.verdictBasisPlace.replace('{title}', ''))
  })
})

describe('PlanDayVerdict — 판정 옆 큰 숫자 (#253)', () => {
  it('체감온도를 그 이름으로 보여 준다', () => {
    const html = render({ weather: weather({ maxFeelsLikeTemperature: 33.4 }) })

    expect(html).toContain('33.4')
    expect(html).toContain(messages.plan.verdictFeelsLikeLabel)
  })

  /*
    #1067 — 일자 카드마다 하나씩 서는 **혼자 서는 값**이다. 카드 사이에 칸을 맞춘 열이 없어
    `.0` 이 자릿수를 맞춰 주지 않는다. 소수가 의미 있는 값(`33.4`)은 위 테스트가 지킨다.
  */
  it('정수 값은 소수점을 떼어 그린다', () => {
    const html = render({ weather: weather({ maxFeelsLikeTemperature: 33 }) })

    expect(html).toContain('>33</span>')
    expect(html).not.toContain('33.0')
  })

  /*
    **최고기온과 나란히 세우지 않는다.** 둘 다 ℃ 라 숫자가 두 개 붙으면 어느 쪽이
    무엇인지 라벨을 읽어야 알 수 있고, "큰 숫자 하나" 라는 이 자리의 성격이 사라진다.
  */
  it('체감온도가 있으면 최고기온을 함께 세우지 않는다', () => {
    const html = render({
      weather: weather({ maxFeelsLikeTemperature: 33.4, maxTemperature: 26 }),
    })

    expect(html).not.toContain(messages.plan.verdictTemperatureLabel)
    // 혼자 서는 값은 `.0` 을 떼므로(#1067) 두 모양을 다 막는다
    expect(html).not.toContain('26.0')
    expect(html).not.toContain('>26</span>')
  })

  /*
    중기예보 구간은 체감온도가 **언제나 null** 이다. 그 자리를 비우면 11일 예보의 뒤쪽
    날들이 통째로 숫자를 잃으므로 최고기온을 세우되 **이름을 바꿔 말하지 않는다.**

    **라벨이 아니라 값 옆 단서가 그 이름을 말한다** (#732) — 나란한 두 일자가 다른 라벨을
    쓰면 값의 차이가 아니라 화면의 오류로 읽혔다.
  */
  it('체감온도가 없으면 최고기온을 세우되 라벨 기둥은 그대로다', () => {
    const html = render({
      weather: weather({
        maxFeelsLikeTemperature: null,
        maxTemperature: 24,
        forecastSourceCode: 'MID_TERM',
        forecastSourceName: '중기예보',
      }),
    })

    expect(html).toContain('>24</span>')
    expect(html).toContain(messages.plan.verdictFeelsLikeLabel)
    // 단서가 값 옆에서 무엇이 섰는지 말한다 — 최고기온을 체감온도라고 부르지 않는다
    expect(html).toContain(messages.plan.verdictFallbackMetric.replace('{source}', '중기예보'))
  })

  it('예보 출처를 몰라도 무엇이 섰는지는 말한다 — 라벨이 고정이라 여기뿐이다', () => {
    const html = render({
      weather: weather({
        maxFeelsLikeTemperature: null,
        maxTemperature: 24,
        forecastSourceCode: 'SHORT_TERM',
        forecastSourceName: null,
      }),
    })

    expect(html).toContain(messages.plan.verdictTemperatureLabel)
  })

  it('체감온도가 선 날에는 단서를 붙이지 않는다 — 기본값이라 말할 차이가 없다', () => {
    const html = render({
      weather: weather({ maxFeelsLikeTemperature: 33.4, forecastSourceCode: 'SHORT_TERM' }),
    })

    expect(html).not.toContain(messages.plan.verdictTemperatureLabel)
  })

  it('예보가 없으면 숫자 자리를 비운다 — 판정 자체는 남는다', () => {
    const html = render({ weather: null })

    expect(html).not.toContain(messages.plan.verdictFeelsLikeLabel)
    expect(html).not.toContain(messages.plan.verdictTemperatureLabel)
    // 등급 배지는 그대로다 — 예보가 없다고 판정을 지우지 않는다
    expect(html).toContain(planVerdict.suitabilityLevel?.name ?? '')
  })
})

/**
 * 판정을 못 낸 날의 문구 — 사유 코드가 가른다 (#497).
 *
 * 문장은 서버 enum(`PlanDayWeatherUnavailableReason`)의 것을 그대로 둔다. 짧게 줄여 적으면
 * **화면이 실제로 받는 문장이 아닌 것으로 검증하게 된다.**
 */
const NO_PLACE_ITEM_SENTENCE =
  '이 날짜에는 장소가 지정된 일정 항목이 없어 날씨를 붙이지 못했습니다.'
const PAST_DATE_SENTENCE =
  '이미 지난 날짜라 예보가 남아 있지 않습니다. 이 날의 날씨는 확인할 수 없습니다.'
const BEYOND_RANGE_SENTENCE =
  '예보는 오늘부터 11일까지만 제공되어 이 날짜는 아직 알려 드릴 수 없습니다.'
const LOOKUP_FAILED_SENTENCE = '날씨 정보를 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.'

/** 판정을 못 낸 날의 공통 모양 — 점수도 등급도 없다 */
function unavailable(code: string | null, reason: string | null): Partial<PlanDayWeatherItem> {
  return {
    score: null,
    suitabilityLevel: null,
    unavailableReasonCode: code,
    unavailableReason: reason,
  }
}

describe('PlanDayVerdict — 판정 불가 사유마다 말이 다르다 (#497)', () => {
  /*
    빈 일차에서 같은 사실을 두 번 말하던 것이 이 이슈다. 아래 `이 날은 아직 담은 곳이
    없어요.` 가 이미 그 말을 하므로 판정 자리는 **입을 다문다.**
  */
  it('NO_PLACE_ITEM 이고 항목이 없으면 아무것도 그리지 않는다 — 빈 일차 안내가 이미 말한다', () => {
    const html = render(unavailable('NO_PLACE_ITEM', NO_PLACE_ITEM_SENTENCE), {
      dayHasItems: false,
    })

    expect(html).toBe('')
  })

  /*
    **산책 항목만 있는 날이 이 갈래다.** `WALK` 의 `targetId` 는 장소가 아니라 판정 기준이
    못 되므로 `NO_PLACE_ITEM` 인데, 항목은 있어 빈 일차 안내가 나지 않는다. 여기서까지
    감추면 판정이 왜 없는지 아무도 말하지 않는다.
  */
  it('NO_PLACE_ITEM 이어도 항목이 있으면 서버 문장을 남긴다 — 대신 말해 줄 안내가 없다', () => {
    const html = render(unavailable('NO_PLACE_ITEM', NO_PLACE_ITEM_SENTENCE), { dayHasItems: true })

    expect(html).toContain(NO_PLACE_ITEM_SENTENCE)
  })

  it('PAST_DATE 는 화면 말투로 바꿔 말하고 재시도를 권하지 않는다', () => {
    const html = render(unavailable('PAST_DATE', PAST_DATE_SENTENCE), { dayHasItems: false })

    expect(html).toContain(messages.plan.verdictPastDate)
    // 합쇼체 서버 문장이 그대로 새어 나오지 않는다 (`DESIGN.md` 문구 톤)
    expect(html).not.toContain(PAST_DATE_SENTENCE)
    expect(html).not.toContain('다시 시도')
  })

  /*
    **예보 범위(11일)는 서버 상수다** (`PlanDayWeatherUnavailableReason.FORECAST_HORIZON_DAYS`).
    화면이 같은 숫자를 베껴 두면 원천 커버리지가 바뀔 때 둘이 갈린다.
  */
  it('BEYOND_FORECAST_RANGE 는 서버 문장을 그대로 쓴다 — 예보 범위는 서버가 안다', () => {
    const html = render(unavailable('BEYOND_FORECAST_RANGE', BEYOND_RANGE_SENTENCE), {
      dayHasItems: true,
    })

    expect(html).toContain(BEYOND_RANGE_SENTENCE)
  })

  it('LOOKUP_FAILED 는 감추지 않는다 — 넷 중 이것만 장애다', () => {
    const html = render(unavailable('LOOKUP_FAILED', LOOKUP_FAILED_SENTENCE), {
      dayHasItems: false,
    })

    expect(html).toContain(LOOKUP_FAILED_SENTENCE)
  })

  /*
    서버가 사유를 늘려도 화면이 말을 잃지 않아야 한다. 코드를 union 으로 좁히지 않고
    `string` 으로 둔 이유이기도 하다.
  */
  it('모르는 코드는 서버 문장으로 물러선다', () => {
    const html = render(unavailable('SOMETHING_NEW', '새로 생긴 사유입니다.'), {
      dayHasItems: true,
    })

    expect(html).toContain('새로 생긴 사유입니다.')
  })

  it('사유가 통째로 비면 자리를 만들지 않는다 — 빈 여백만 남는다', () => {
    const html = render(unavailable(null, null), { dayHasItems: true })

    expect(html).toBe('')
  })
})

/**
 * 판정 배지의 **여는 태그 class** 만 추린다 (#842).
 *
 * 배지와 밴드가 같은 톤 문자열을 쓰므로 마크업 전체를 `toContain` 으로 보면 어느 쪽이
 * 그것을 냈는지 구분하지 못한다. 구조는 `<span class=배지><span class=축>축 </span>등급어</span>`.
 */
/**
 * 판정이 자기 영역을 갖는다 (#842).
 *
 * 예전에는 판정 덩어리가 일자 헤더와 **같은 인셋 · 같은 바닥**이라, 근거 문장이 `1일차` 의
 * 설명인지 첫 항목의 설명인지 시각적으로 갈리지 않았다.
 */
describe('PlanDayVerdict — 등급 tint 밴드', () => {
  it('등급 tint 면과 -500 실선이 짝으로 선다', () => {
    const html = render()

    expect(html).toContain('bg-metric-high-100')
    expect(html).toContain('border-metric-high-500')
  })

  /*
    **면만 깔지 않는다** (DESIGN.md §2-3 · #709). tint 는 바닥과 밝기로 갈리지
    않아(1.01~1.06:1) 면만으로는 적록색약에게 칠하지 않은 것과 같다 — `-500` 실선이 짝이다.
    선만 빼도 위 단언이 통과하므로 **`border` 유틸리티까지 함께 잠근다.**
  */
  it('면에 실선 테두리가 실제로 붙는다', () => {
    expect(render()).toMatch(/class="[^"]*\bborder\b[^"]*border-metric-high-500/)
  })

  /*
    **밴드 머리에 배지를 세우지 않는다** (#856). 12px 배지 하나와 22px 큰 숫자가 한 줄에
    서던 자리다 — 배지는 `MetricBadge` 의 기본 크기를 그대로 쓴 값이라 이 자리를 위해 고른
    것이 아니었다. 등급어는 `MetricWord`(20/800)로 올라가 오른쪽 온도와 같은 리듬이 된다.

    **등급어 색은 `-700` 층이다** (`METRIC_WORD_TONE`) — tint 면 위 텍스트는 4.5:1 을
    넘어야 하고 `-500` 은 그 기준 밖이다 (DESIGN.md §2-3).
  */
  it('밴드 머리는 배지가 아니라 등급어로 판정을 말한다', () => {
    const html = render()
    const name = planVerdict.suitabilityLevel?.name ?? ''

    expect(html).toMatch(new RegExp(`class="[^"]*text-metric-high-700[^"]*">${name}</span>`))
    expect(html).not.toContain('bg-bg border-metric-high-500')
  })

  /*
    **등급 색 막대는 `-500` 면이다** (`METRIC_FILL_TONE`) — 글자가 얹히지 않는 비텍스트라
    3:1 기준이고, 그 층이 tint 면 위에서 눈에 잡히는 유일한 층이다.
  */
  it('등급어 옆에 -500 색 막대가 선다', () => {
    expect(render()).toMatch(/class="[^"]*\bw-1\b[^"]*bg-metric-high-500/)
  })

  /*
    **근거를 접지 않는다** (#840). 그리고 **불릿을 달지 않는다** — `ReasonList` 의 `ul` 이
    `flex` 라 `list-disc` 가 조용히 무시되고, 나머지 네 근거 목록이 전부 평범한 문장
    스택이라 일차 카드만 불릿이면 #840 이 없앤 분기가 되살아난다.
  */
  it('근거를 전부 문장 스택으로 세운다 — 접지도 불릿을 달지도 않는다', () => {
    const html = render()

    expect(html).toContain('<ul')
    expect(html).not.toContain('aria-expanded')
    expect(html).not.toContain('list-disc')
  })

  /* 판정을 못 낸 날을 낮은 등급으로 칠하지 않는다 — 중립 면이라 밴드가 사라지지도 않는다 */
  it('판정을 못 낸 날은 중립 면에 문장만 든다', () => {
    const html = render({
      score: null,
      suitabilityLevel: null,
      unavailableReasonCode: 'PAST_DATE',
    })

    expect(html).toContain('bg-band')
    expect(html).toContain(messages.plan.verdictPastDate)
    expect(html).not.toContain('bg-metric-high-100')
  })

  /* 말할 것이 없으면 자리도 만들지 않는다 — 빈 밴드가 서면 안 된다 */
  it('할 말이 없는 날은 밴드 자체가 없다', () => {
    const html = render(
      { score: null, suitabilityLevel: null, unavailableReasonCode: 'NO_PLACE_ITEM' },
      { dayHasItems: false },
    )

    expect(html).toBe('')
  })

  /* 체감온도는 중립 수치다 — 등급 색을 숫자에 쓰지 않는다 (DESIGN.md §2-3) */
  it('온도 값에 등급 색을 쓰지 않는다', () => {
    expect(render()).not.toContain('text-metric-high-500')
  })

  /*
    **정보성을 경고 아래 보조 묶음으로 내린다** (#1016). 이 밴드는 일정 상세에서 항목 목록
    위에 서서 근거 다섯이 같은 22px 줄을 차지하면 첫 항목이 접힘 아래로 밀렸다. 서버 문장 ·
    접지 않음(#840) · 각 묶음의 서버 순서는 그대로다.
  */
  it('정보성 근거를 경고 아래 caption 묶음으로 모은다 — 순서와 문장은 서버 그대로다', () => {
    const reason = (code: string, scoreDelta: number) => ({
      code,
      name: code,
      description: `${code} 문장입니다.`,
      scoreDelta,
    })
    const html = render({
      reasons: [
        reason('INFO_A', 0),
        reason('HEAT', -15),
        reason('INFO_B', 0),
        reason('WIND', -5),
        reason('INFO_C', 0),
      ],
    })

    const lists = [...html.matchAll(/<ul class="([^"]*)">(.*?)<\/ul>/g)].map((match) => ({
      classes: (match[1] ?? '').split(' '),
      items: [...(match[2] ?? '').matchAll(/<li class="([^"]*)">([^<]*)<\/li>/g)].map((li) => ({
        classes: (li[1] ?? '').split(' '),
        text: li[2],
      })),
    }))

    expect(lists.map((list) => list.items.map((item) => item.text))).toEqual([
      ['HEAT 문장입니다.', 'WIND 문장입니다.'],
      ['INFO_A 문장입니다.', 'INFO_B 문장입니다.', 'INFO_C 문장입니다.'],
    ])
    for (const item of lists[0]?.items ?? []) expect(item.classes).toContain('text-body-2')
    for (const item of lists[1]?.items ?? []) {
      expect(item.classes).toContain('text-caption')
      expect(item.classes).toContain('text-fg-muted')
    }
    expect(lists[1]?.classes).toContain('gap-1')
  })
})

/*
  **좋은 판정의 감점은 "살펴볼 점" 이다** (#1179). 초록 `여행 적합` 아래 가장 큰 문장이 감점 하나라
  판정과 반대 방향의 말이 이유처럼 읽혔다. 순서 · 문장은 서버 그대로이고 이름만 붙인다.
*/
describe('PlanDayVerdict — 좋은 판정의 감점 근거 (#1179)', () => {
  const crowded = {
    code: 'CROWDED',
    name: '혼잡',
    description: '관광객 집중률 74% 로 붐빌 것으로 예상됩니다.',
    scoreDelta: -8,
  }
  const petAllowed = planVerdict.reasons[0]
  if (petAllowed === undefined) throw new Error('fixture 에 근거가 있어야 한다')

  it('여행 적합인데 감점이 있으면 근거 위에 살펴볼 점이 선다', () => {
    const html = render({ reasons: [crowded, petAllowed] })

    expect(html).toContain(messages.plan.verdictCaveatsLabel)
    expect(html.indexOf(messages.plan.verdictCaveatsLabel)).toBeLessThan(
      html.indexOf(crowded.description),
    )
  })

  it('감점이 없으면 서지 않는다', () => {
    expect(render({ reasons: [petAllowed] })).not.toContain(messages.plan.verdictCaveatsLabel)
  })

  it('낮은 판정의 날에는 서지 않는다 — 감점이 곧 이유다', () => {
    const html = render({
      reasons: [crowded],
      suitabilityLevel: {
        code: 'LOW',
        name: '여행 주의',
        description: null,
        scoreDescription: null,
      },
    })

    expect(html).not.toContain(messages.plan.verdictCaveatsLabel)
  })
})

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { RegionalWeatherSection } from '@/features/home/regional-weather-section'
import { mockRegionalWeather } from '@/lib/api/mock/insight-data'
import { messages } from '@/lib/messages'
import type { RegionalWeatherResponse } from '@/types/insight'

function render(data: RegionalWeatherResponse | null, loading = false) {
  return renderToStaticMarkup(createElement(RegionalWeatherSection, { data, loading }))
}

/** 추천이 있는 날. mock 점수는 `72 · 86 · 64 · 78` 이라 **단독 1위**다 */
const GOOD_DAY = mockRegionalWeather(false)
/** 특보 경보로 추천이 없는 날 */
const BAD_DAY = mockRegionalWeather(true)

/**
 * 2026-09-15 dev 실측 — 점수 있는 권역이 전부 100 인 날 (#638).
 *
 * **드문 날이 아니다.** 날씨만 보는 점수라 섬 전체가 맑으면 다섯이 같은 값으로 나온다.
 * `한라산권`(예보 없음)은 mock 그대로 null 이라 셈에서 빠진다.
 */
const TIED_DAY: RegionalWeatherResponse = {
  ...GOOD_DAY,
  regions: GOOD_DAY.regions.map((region) =>
    region.weatherScore === null ? region : { ...region, weatherScore: 100 },
  ),
}

/** 최고점이 둘뿐인 날 — 전부 동점과 갈래가 다르다 */
const TWO_TIED_DAY: RegionalWeatherResponse = {
  ...GOOD_DAY,
  regions: GOOD_DAY.regions.map((region, index) =>
    region.weatherScore === null ? region : { ...region, weatherScore: index < 2 ? 100 : 60 },
  ),
}

describe('RegionalWeatherSection — 추천', () => {
  it('추천 권역과 이유를 서버 문장 그대로 쓴다', () => {
    const markup = render(GOOD_DAY)

    expect(markup).toContain('서귀포권')
    expect(markup).toContain(GOOD_DAY.recommendationReasons[0] as string)
  })

  /*
    적합도는 0점, 산책은 위험이라고 말하는 같은 서비스가 여기서만 "여기 가세요" 라고 하면
    안 된다. 서버가 경보일 때 recommendedRegion 을 null 로 주는 이유이고, 화면이 대체
    권역을 지어내면 그 설계가 무너진다.
  */
  it('추천이 없는 날에 권역을 지어내지 않는다', () => {
    const markup = render(BAD_DAY)

    expect(markup).toContain(messages.home.regionNone)
    expect(markup).not.toContain(messages.home.regionRecommended.replace('{name}', ''))
  })

  it('추천이 없어도 비교표는 그대로 보여 준다 — 여전히 정보다', () => {
    const markup = render(BAD_DAY)

    expect(markup).toContain('제주시권')
    expect(markup).toContain('한라산권')
  })
})

/*
  **#905 R2 — 추천이 없는 이유를 한 줄 말한다.** `regionNone` 한 줄만 있으면 바로 아래 표에
  점수 배지가 그대로 서 있어 "점수는 있는데 추천할 곳이 없다" 는 모순처럼 읽혔다.
*/
describe('RegionalWeatherSection — 추천 없음 사유 (#905 R2)', () => {
  /** 어느 권역도 예보를 못 받은 날 — 서버가 추천을 비우는 첫째 경우다 */
  const NO_FORECAST_DAY: RegionalWeatherResponse = {
    ...BAD_DAY,
    weatherWarning: null,
    // 예보를 못 받은 권역은 점수뿐 아니라 날씨 값도 전부 null 이다 (`RegionWeatherItem` 주석)
    regions: BAD_DAY.regions.map((region) => ({
      ...region,
      weatherScore: null,
      temperature: null,
      humidity: null,
      skyState: null,
      precipitationType: null,
    })),
  }

  it('경보로 추천이 빈 날은 경보를 사유로 든다', () => {
    const markup = render(BAD_DAY)

    expect(markup).toContain(messages.home.regionNoneWarning)
    expect(markup).not.toContain(messages.home.regionNoneForecast)
  })

  it('예보를 못 받아 추천이 빈 날은 예보를 사유로 든다', () => {
    const markup = render(NO_FORECAST_DAY)

    expect(markup).toContain(messages.home.regionNoneForecast)
    expect(markup).not.toContain(messages.home.regionNoneWarning)
  })

  /*
    주의보가 떠 있는데 예보까지 못 받은 날. 추천이 빈 이유는 예보이고, `weatherWarning` 이
    null 이 아니라는 것만 보고 "경보가 발효 중" 이라고 말하면 거짓이 된다.
  */
  it('특보가 있어도 점수 있는 권역이 없으면 예보를 사유로 든다', () => {
    const warning = BAD_DAY.weatherWarning
    if (warning === null) throw new Error('mock 경보 날에 특보가 있어야 한다')

    const markup = render({
      ...NO_FORECAST_DAY,
      weatherWarning: {
        ...warning,
        level: { code: 'ADVISORY', name: '주의보', description: '주의가 필요한 단계입니다.' },
      },
    })

    expect(markup).toContain(messages.home.regionNoneForecast)
    expect(markup).not.toContain(messages.home.regionNoneWarning)
  })

  it('사유는 추천 없음 문장 바로 아래 보조 글줄이다', () => {
    const markup = render(BAD_DAY)
    const none = markup.indexOf(messages.home.regionNone)
    const reason = markup.indexOf(
      `<p class="text-body-2 text-fg-muted">${messages.home.regionNoneWarning}`,
    )

    expect(none).toBeGreaterThan(-1)
    expect(reason).toBeGreaterThan(none)
  })

  it('추천이 있는 날에는 사유를 내지 않는다', () => {
    const markup = render(GOOD_DAY)

    expect(markup).not.toContain(messages.home.regionNoneWarning)
    expect(markup).not.toContain(messages.home.regionNoneForecast)
  })
})

describe('RegionalWeatherSection — 비교표', () => {
  it('다섯 권역을 모두 남긴다', () => {
    const markup = render(GOOD_DAY)

    for (const name of ['제주시권', '서귀포권', '동부권', '서부권', '한라산권']) {
      expect(markup).toContain(name)
    }
  })

  /*
    예보를 못 받은 권역을 목록에서 지우면 사용자는 그 권역이 조회되지 않았다는 것조차
    모른 채 "비교 대상이 넷" 이라고 읽는다. 0 으로 채우면 "나쁘다" 로 읽는다.
  */
  it('예보를 못 받은 권역은 0 이 아니라 "예보 없음" 이다', () => {
    const markup = render(GOOD_DAY)

    expect(markup).toContain(messages.home.regionScoreUnavailable)
    expect(markup).toContain('한라산권')
  })

  /*
    **#342 에서 하단 보조 문구를 걷었고 #638 이 머리로 올렸다.** 걷은 이유는 위치였다 —
    표 아래 한 줄은 배지를 다 읽은 뒤에야 닿아서, 무엇의 100인지 모르는 채로 다섯 칸을
    훑게 된다. 점수의 뜻은 이제 카드 제목 아래(`Surface description`)가 말한다.
  */
  it('보조 문구를 표 아래로 되돌리지 않는다', () => {
    const markup = render(GOOD_DAY)
    const caption = markup.indexOf(messages.home.regionScoreCaption)
    const firstCell = markup.indexOf('w-44')

    expect(markup).not.toContain('날씨만 본 점수')
    expect(caption).toBeGreaterThan(-1)
    expect(caption).toBeLessThan(firstCell)
  })
})

/*
  **#638 — 무엇의 100인지 화면이 말한다.** 2026-09-15 실측에서 다섯 배지가 전부 `100`
  이었는데 만점도 단위도 어디에도 없었다. 같은 화면의 장소 적합도는 `90 /100` 으로 쓰고
  있어서, 권역 배지만 축이 다른 값처럼 보였다.
*/
describe('RegionalWeatherSection — 점수 라벨 (#638)', () => {
  it('카드 제목 아래에서 점수의 뜻과 만점을 밝힌다', () => {
    expect(render(GOOD_DAY)).toContain(messages.home.regionScoreCaption)
  })

  it('점수 배지에 단위를 붙인다', () => {
    const markup = render(GOOD_DAY)
    const score = GOOD_DAY.regions.find((r) => r.weatherScore !== null)?.weatherScore as number

    expect(markup).toContain(messages.home.regionScoreUnit.replace('{score}', String(score)))
  })

  /*
    예보를 못 받은 권역은 `0점` 이 아니라 `예보 없음` 이다 — 모르는 것과 나쁜 것은 다르다.
    마크업 전체에서 `0점` 을 금지할 수는 없다 (캡션이 `100점 만점` 이다). 그 권역의 칸만 본다.
  */
  it('예보 없는 권역에 단위를 붙이지 않는다', () => {
    const markup = render(GOOD_DAY)
    const cell = markup.slice(markup.indexOf('한라산권'))

    expect(cell).toContain(messages.home.regionScoreUnavailable)
    expect(cell).not.toContain('점<')
  })

  /* 스켈레톤은 제목도 캡션도 없는 표면이다 — 로딩 중에 캡션만 먼저 뜨면 안 된다 */
  it('로딩 중에는 캡션을 내지 않는다', () => {
    expect(render(null, true)).not.toContain(messages.home.regionScoreCaption)
  })
})

/*
  **#638 — 동점이면 1위를 단정하지 않는다.** 실측에서 배지 다섯이 전부 `100` 인데 문장은
  "오늘은 제주시권이 가장 나아요" 였다. 바로 아래 표가 그 말을 받쳐 주지 못하면 사용자는
  자기가 표를 잘못 읽었다고 생각한다.
*/
describe('RegionalWeatherSection — 동점 문장 (#638)', () => {
  it('점수 있는 권역이 전부 동점이면 한 곳을 고르지 않는다', () => {
    const markup = render(TIED_DAY)

    expect(markup).toContain(messages.home.regionTiedAll)
    expect(markup).not.toContain('가장 나아요')
  })

  it('두 곳만 동점이면 그 이름들을 세운다', () => {
    const markup = render(TWO_TIED_DAY)

    expect(markup).toContain(messages.home.regionTied.replace('{names}', '서귀포권 · 제주시권'))
    expect(markup).not.toContain('가장 나아요')
  })

  /* 서버가 고른 권역을 지우지 않고 앞세운다 — 동점 문장이 바꾸는 것은 "어디가" 뿐이다 */
  it('서버 추천 권역이 동점 문장의 첫 자리다', () => {
    const markup = render(TWO_TIED_DAY)

    expect(markup).toContain('오늘은 서귀포권 · 제주시권이')
  })

  /* 근거 문장은 "왜 좋은가" 라 동점이든 아니든 그대로 붙는다 */
  it('동점이어도 서버 근거 문장을 그대로 붙인다', () => {
    expect(render(TIED_DAY)).toContain(TIED_DAY.recommendationReasons[0] as string)
  })

  it('단독 1위는 현행 문장 그대로다', () => {
    const markup = render(GOOD_DAY)

    expect(markup).toContain(messages.home.regionRecommended.replace('{name}', '서귀포권'))
    expect(markup).not.toContain(messages.home.regionTiedAll)
  })

  /*
    서버가 추천을 내지 않은 날에 동점을 세어 "어디든 좋아요" 라고 말하면, 서버가 막아 둔
    문을 화면이 다시 여는 것이 된다. mock 의 경보 날은 점수가 전부 갈려 있지만 여기서는
    **점수를 전부 같게 만들어** 계산이 돌지 않는다는 것을 직접 잡는다.
  */
  it('추천이 없는 날에는 동점을 세지 않는다', () => {
    const markup = render({
      ...BAD_DAY,
      regions: BAD_DAY.regions.map((region) =>
        region.weatherScore === null ? region : { ...region, weatherScore: 100 },
      ),
    })

    expect(markup).toContain(messages.home.regionNone)
    expect(markup).not.toContain(messages.home.regionTiedAll)
  })
})

/*
  **#342.** 값 넷이 한 줄로 흐르던 것을 아이콘 / 숫자 두 줄 / 배지 세 자리로 갈랐고,
  아이콘에 날씨 전용 색(`--weather-*`)을 줬다. 등급 색(`--metric-*`)과 다른 축이다.
*/
describe('RegionalWeatherSection — 날씨 아이콘 (#342)', () => {
  it('맑은 권역의 아이콘에 해 색을 준다', () => {
    expect(render(GOOD_DAY)).toContain('text-weather-sun')
  })

  it('비 오는 권역의 아이콘에 비 색을 준다', () => {
    const markup = render(GOOD_DAY)

    expect(markup).toContain('text-weather-rain')
    expect(markup).toContain('비')
  })

  /*
    등급 색을 날씨에 전용하지 않는다 — 두 축이 섞이면 점수와 날씨가 같은 것으로 읽힌다.

    **마크업 전체에서 금지할 수는 없다** — 같은 행의 점수 배지는 등급 색을 쓰는 것이
    맞다. 아이콘 래퍼(`inline-flex shrink-0 items-center …`)만 본다.
  */
  it('아이콘 래퍼에 등급 색을 쓰지 않는다', () => {
    const markup = render(GOOD_DAY)
    const wrappers = [...markup.matchAll(/class="inline-flex shrink-0 items-center([^"]*)"/g)].map(
      (match) => match[1] ?? '',
    )

    expect(wrappers.length).toBeGreaterThan(0)
    expect(wrappers.filter((classes) => classes.includes('metric'))).toEqual([])
  })

  /* §9 "24px 기본". 16px 인라인이던 것을 키웠다 */
  it('아이콘이 24px 이다', () => {
    expect(render(GOOD_DAY)).toContain('width="24"')
  })

  /* 아이콘은 장식이고 의미는 sr-only 낱말이 진다 — 색을 줘도 이 구조는 그대로다 */
  it('색을 줘도 sr-only 낱말을 남긴다', () => {
    const markup = render(GOOD_DAY)

    expect(markup).toContain('sr-only')
    expect(markup).toContain('맑음')
  })

  /*
    값이 둘 다 없는 권역(`한라산권`)에 빈 flex 항목을 남기면 부모의 `gap-2` 가 그 자리에도
    붙어 배지가 8px 밀린다. 두 줄로 쌓으면서 감싼 `<span>` 이 생겨 처음 생긴 갈래다.
  */
  /* 클래스 문자열이 실제 마크업과 같아야 한다 — 갈리면 이 단언이 헛되이 통과한다 */
  it('값이 없는 권역에 빈 숫자 자리를 남기지 않는다', () => {
    const markup = render(GOOD_DAY)
    const numbers = '<span class="flex w-20 flex-col items-start lg:w-22">'

    expect(markup).toContain(numbers)
    expect(markup).not.toContain(`${numbers}</span>`)
  })
})

/*
  #530 — 권역 표가 1024 미만에서 세로 목록으로 풀렸다. **권역은 서로 견주라고 있는
  표인데** 세로로 세우면 한 번에 한 권역만 보여 비교가 안 되고, 좁은 폭일수록 칸 한 장이
  화면의 5분의 1을 먹는다.
*/
describe('RegionalWeatherSection — 모든 폭에서 가로 레일 (#530)', () => {
  const markup = render(GOOD_DAY)

  it('좁은 폭에서도 세로 목록으로 풀지 않는다', () => {
    expect(markup).not.toContain('flex-col lg:flex-row')
    expect(markup).not.toContain('lg:overflow-x-auto')
  })

  /* 스냅·넘침이 `lg:` 뒤에 남으면 좁은 폭에서 칸이 중간에 잘린 채 멈춘다 */
  it('스냅과 가로 넘침이 폭 분기 없이 걸린다', () => {
    expect(markup).toContain('overflow-x-auto')
    expect(markup).toContain('snap-x snap-mandatory')
    expect(markup).not.toContain('lg:snap-x')
  })

  /*
    **칸 폭은 좁은 폭에서 한 단 낮다** — 375 의 가용폭 343 에서 184 로 두면 둘째 칸이
    159px 만 보인다. 숫자 자리도 함께 내려간다 (`styles/overlay-and-region-cell.test.ts`
    가 그 관계를 산식으로 잡는다).
  */
  it('칸 폭이 좁은 폭과 lg 로 갈린다', () => {
    expect(markup).toContain('w-44')
    expect(markup).toContain('lg:w-46')
  })

  /*
    **표 위에 1px 선을 넣는다.** 추천 문장과 비교표는 같은 인셋의 본문 글줄이라 선이
    없으면 한 덩어리로 읽혔다 — 위는 서버가 고른 답이고 아래는 그 답을 견주는 근거다.
  */
  it('추천 문장과 표 사이에 1px 선이 있다', () => {
    const recommendation = markup.indexOf('서귀포권이')
    const divider = markup.indexOf('border-t')
    const firstCell = markup.indexOf('w-44')

    expect(recommendation).toBeGreaterThan(-1)
    expect(divider).toBeGreaterThan(recommendation)
    expect(divider).toBeLessThan(firstCell)
  })
})

describe('RegionalWeatherSection — 상태', () => {
  it('조회 실패는 섹션을 통째로 숨긴다', () => {
    expect(render(null)).toBe('')
  })

  it('로딩 중에는 skeleton 만 보인다', () => {
    const markup = render(null, true)

    expect(markup).toContain('animate-pulse')
    expect(markup).not.toContain('서귀포권')
  })

  /*
    **#349.** 예전에는 이 섹션이 제목 옆에 특보 배지를 그렸고, 그것이 모바일의 유일한 특보
    표시를 겸했다. 페이지 최상단 `WeatherWarningStrip` 하나로 모으면서 여기서 걷었다 —
    세 섹션의 `weatherWarning` 은 백엔드 단일 지점에서 온 같은 값이라 갈릴 수 없다.
  */
  /*
    **낱말 `경보` 로 잡지 않는다** (#905 R2). 추천 없음 사유가 "기상특보 경보가 발효 중" 이라고
    말하게 되면서 그 낱말은 이 섹션에 정당하게 선다. 배지가 쓰던 것은 특보 **종류** 이름이다.
  */
  it('특보가 있어도 배지를 그리지 않는다', () => {
    const warning = BAD_DAY.weatherWarning

    expect(warning).not.toBeNull()
    expect(render(BAD_DAY)).not.toContain(warning?.type.name as string)
  })
})

/*
  **#206.** 표가 온도를 숫자만 그려서 `27.0℃` 가 최고기온인지 최저인지 알 수 없었다.
  바로 위 추천 문장은 서버가 준 완성형이라 "최고기온 26도, 강수확률 20% 로 …" 라고
  정확히 말하는데, 같은 카드 안에서 표에만 라벨이 없었다.

  dev 는 `minTemperature === maxTemperature` 인 날이 많아 드러나지 않았다 —
  값이 갈리는 순간 사용자가 무슨 온도인지 알 수 없다 (DESIGN.md §2-3).
*/
describe('RegionalWeatherSection — 온도 라벨 (#206)', () => {
  it('온도가 최고기온임을 밝힌다', () => {
    const markup = render(GOOD_DAY)
    const max = GOOD_DAY.regions.find((r) => r.maxTemperature !== null)?.maxTemperature as number

    expect(markup).toContain(`${messages.home.regionTempPrefix} ${max.toFixed(1)}℃`)
  })

  /* 예보를 못 받은 권역에는 라벨만 남지 않아야 한다 — 값이 없으면 자리 자체가 없다 */
  it('온도가 없는 권역에 라벨만 남기지 않는다', () => {
    const markup = render({
      ...GOOD_DAY,
      regions: GOOD_DAY.regions.map((region) => ({
        ...region,
        minTemperature: null,
        maxTemperature: null,
      })),
    })

    expect(markup).not.toContain(messages.home.regionTempPrefix)
  })
})

/*
  **#352.** 서버가 `minTemperature` 를 이미 주고 있었는데 화면이 버렸다. 최고만 있으면
  31.0℃ 한 값으로 읽히는데, 아침 산책을 계획하는 사람에게는 그 값이 몇 시의 이야기인지가
  판단을 가른다.

  dev 는 `minTemperature === maxTemperature` 인 날이 많아 이 차이가 드러나지 않는다 —
  그래서 mock 이 24.0 / 31.0 으로 갈라 둔 값으로 검사한다.
*/
describe('RegionalWeatherSection — 최저기온 (#352)', () => {
  it('최고 아래에 최저기온을 라벨과 함께 낸다', () => {
    const markup = render(GOOD_DAY)
    const region = GOOD_DAY.regions.find((r) => r.minTemperature !== null)
    const min = region?.minTemperature as number

    expect(markup).toContain(`${messages.home.regionMinTempPrefix} ${min.toFixed(1)}℃`)
  })

  /* 최고 → 최저 → 강수 순서다. 접두 길이가 같아 두 줄의 숫자 왼쪽 끝이 맞는다 */
  it('최고보다 뒤, 강수보다 앞에 선다', () => {
    const markup = render(GOOD_DAY)

    const max = markup.indexOf(messages.home.regionTempPrefix)
    const min = markup.indexOf(messages.home.regionMinTempPrefix)
    const rain = markup.indexOf('강수 ')

    expect(max).toBeGreaterThanOrEqual(0)
    expect(min).toBeGreaterThan(max)
    expect(rain).toBeGreaterThan(min)
  })

  it('최고와 최저의 접두 길이가 같다 — 숫자 왼쪽 끝이 어긋나지 않는다', () => {
    expect(messages.home.regionMinTempPrefix.length).toBe(messages.home.regionTempPrefix.length)
  })

  /* 최저만 없는 날에 라벨만 남기지 않는다. 최고·강수는 그대로 서야 한다 */
  it('최저기온이 없으면 그 줄만 빠지고 최고·강수는 남는다', () => {
    const markup = render({
      ...GOOD_DAY,
      regions: GOOD_DAY.regions.map((region) => ({ ...region, minTemperature: null })),
    })

    expect(markup).not.toContain(messages.home.regionMinTempPrefix)
    expect(markup).toContain(messages.home.regionTempPrefix)
    expect(markup).toContain('강수 ')
  })

  /*
    셋 다 없으면 감싼 `<span>` 자체를 내지 않는다 — 빈 flex 항목을 남기면 부모의 `gap-2`
    가 그 자리에도 붙어 배지가 8px 밀린다 (#342 가 두 값일 때 잡아 둔 갈래).
  */
  it('세 값이 다 없으면 감싼 자리도 내지 않는다', () => {
    const markup = render({
      ...GOOD_DAY,
      regions: GOOD_DAY.regions.map((region) => ({
        ...region,
        minTemperature: null,
        maxTemperature: null,
        maxPrecipitationProbability: null,
      })),
    })

    expect(markup).not.toContain('<span class="flex flex-col items-start">')
  })
})

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { WalkTimesSection } from '@/features/home/walk-times-section'
import { mockWalkTimes } from '@/lib/api/mock/insight-data'
import { messages } from '@/lib/messages'
import type { WalkTimesResponse } from '@/types/insight'

function render(data: WalkTimesResponse | null, loading = false, positionFallback = false) {
  return renderToStaticMarkup(createElement(WalkTimesSection, { data, loading, positionFallback }))
}

/** 골든타임이 있는 날 (mock 의 `heatSensitive: false` 갈래) */
const GOOD_DAY = mockWalkTimes(false)
/** 특보 경보로 추천이 없는 날 */
const BAD_DAY = mockWalkTimes(true)

describe('WalkTimesSection — 추천 구간', () => {
  it('골든타임을 시각 문장으로 적는다 — 곡선 색에만 기대지 않는다', () => {
    const markup = render(GOOD_DAY)

    expect(markup).toContain('18:00')
    expect(markup).toContain('21:00')
  })

  /*
    **#200 회귀.** dev 22:12 KST 에 서버가 `goldenStart == goldenEnd == 23:00` 을 줬다 —
    그날 남은 시간대가 한 칸뿐이면 시작과 끝이 같다. `hasGolden` 이 null 검사만 해서
    화면이 `23:00 – 23:00` 을 찍었고, 0분짜리 구간은 고장으로 읽힌다.
  */
  it('시작과 끝이 같으면 0분 구간이 아니라 한 시각으로 말한다', () => {
    const markup = render({
      ...GOOD_DAY,
      goldenStart: '2026-09-03T23:00:00',
      goldenEnd: '2026-09-03T23:00:00',
    })

    expect(markup).toContain('23:00')
    expect(markup).not.toContain('23:00 – 23:00')
    expect(markup).toContain(messages.home.goldenSingleHour.replace('{time}', '23:00'))
  })

  /*
    **구간으로 늘리지 않는다.** 예보 단위가 1시간이라 `23:00 – 24:00` 이 그럴듯해 보이지만
    서버가 주지 않은 끝시각을 화면이 만드는 것이다 — 이 섹션은 구간을 지어내지 않기로 한
    자리다 (바로 아래 테스트와 같은 규칙).
  */
  it('한 시각을 한 시간짜리 구간으로 늘리지 않는다', () => {
    const markup = render({
      ...GOOD_DAY,
      goldenStart: '2026-09-03T23:00:00',
      goldenEnd: '2026-09-03T23:00:00',
    })

    expect(markup).not.toContain('24:00')
    expect(markup).not.toContain('00:00')
  })

  /** 서로 다르면 그대로 구간이다 — 위 분기가 정상 경로를 잡아먹지 않아야 한다 */
  it('시작과 끝이 다르면 구간으로 적는다', () => {
    const markup = render(GOOD_DAY)

    expect(markup).toContain('18:00')
    expect(markup).toContain('21:00')
    expect(markup).not.toContain(messages.home.goldenSingleHour.replace('{time}', '18:00'))
  })

  /*
    이 테스트가 이 화면의 핵심이다. 서버는 남은 시간이 전부 위험이면 일부러 구간을 주지
    않는다 — "그나마 이때가 낫다" 고 말하면 사용자가 그것을 허락으로 읽기 때문이다
    (`GoldenWalkWindow`). 화면이 대체 구간을 지어내면 그 설계가 무너진다.
  */
  it('추천이 없는 날에 시간대를 지어내지 않는다', () => {
    const markup = render(BAD_DAY)

    expect(markup).toContain(messages.home.goldenNone)
    expect(markup).not.toContain('18:00')
    expect(markup).not.toContain('–')
  })

  it('추천이 없어도 곡선은 그대로 보여 준다 — 근거를 감추지 않는다', () => {
    const markup = render(BAD_DAY)

    expect(markup).toContain('14시')
    expect(markup).toContain('21시')
  })
})

describe('WalkTimesSection — 곡선', () => {
  it('시각과 노면온도를 함께 둔다 — 색만으로 정보를 전달하지 않는다 (DESIGN.md §2-3)', () => {
    const markup = render(GOOD_DAY)

    expect(markup).toContain('14시')
    // `formatCelsius` 는 소수점 1자리를 유지한다 — 목록에서 자릿수가 흔들리지 않게
    expect(markup).toContain('58.0℃')
  })

  it('막대의 등급 이름을 보조기기에 남긴다', () => {
    const markup = render(GOOD_DAY)

    expect(markup).toContain('sr-only')
    expect(markup).toContain(GOOD_DAY.hourly[0]?.walkSafetyLevel.name as string)
  })

  it('남은 예보가 없으면 빈 곡선을 그리지 않는다 — 판정 자리가 대신 말한다', () => {
    const markup = render({ ...GOOD_DAY, hourly: [] })

    expect(markup).not.toContain('overflow-x-auto')
  })
})

/*
  **#204.** dev 23:17 KST 에 서버가 `hourly: []` · `goldenStart: null` 을 줬다 — 오늘 남은
  시간대가 0칸이라는 뜻이다. 그런데 판정 자리가 `goldenStart` 만 보고 갈라져서 화면이
  `남은 시간이 모두 위험 등급이에요` 를 단정했고, 바로 아래 곡선 자리에서는
  `오늘 남은 예보가 없어요` 가 나왔다 — 한 카드 안에 모순된 두 문장이 같이 나갔다.

  모르는 것과 나쁜 것을 구분하는 것이 이 서비스의 규칙이다 (루트 `CLAUDE.md`).
*/
describe('WalkTimesSection — 예보가 없는 날 (#204)', () => {
  /*
    dev 실측 모양이다 — `hourly: []` · 구간 셋 다 null · `weatherWarning: null`.
    특보가 있는 `BAD_DAY` 를 베이스로 쓰지 않는 이유는 특보 배지 자체가 위험 톤을 쓰기
    때문이다: 그러면 아래 톤 검사가 판정 자리를 보는지 배지를 보는지 알 수 없어진다.
  */
  const NO_FORECAST: WalkTimesResponse = {
    ...GOOD_DAY,
    hourly: [],
    goldenStart: null,
    goldenEnd: null,
    goldenLevel: null,
  }

  it('예보가 0건이면 위험 등급을 단정하지 않는다', () => {
    const markup = render(NO_FORECAST)

    expect(markup).not.toContain(messages.home.goldenNone)
    expect(markup).not.toContain(messages.home.goldenNoneDesc)
  })

  it('판정할 근거가 없다고 말한다', () => {
    const markup = render(NO_FORECAST)

    expect(markup).toContain(messages.home.goldenNoForecast)
    expect(markup).toContain(messages.home.goldenNoForecastDesc)
  })

  /* 색은 등급을 말하는데 이 자리에는 등급이 없다 — 미지는 미지의 모양이어야 한다 */
  it('위험 톤을 쓰지 않는다 (DESIGN.md §2-3)', () => {
    expect(render(NO_FORECAST)).not.toContain('text-metric-critical-700')
    expect(render(BAD_DAY)).toContain('text-metric-critical-700')
  })

  it('같은 문장을 판정 자리와 곡선 자리에 두 번 두지 않는다', () => {
    const markup = render(NO_FORECAST)
    const occurrences = markup.split(messages.home.goldenNoForecast).length - 1

    expect(occurrences).toBe(1)
  })

  /*
    **예보 없음이 밀어내는 것은 위험 단정 하나뿐이다.** 서버가 구간을 주는데 곡선만 못
    받았다면 그것은 추천이 있는 날이고, 화면이 그 추천을 감추면 안 된다.
  */
  it('구간이 있는데 곡선만 비었으면 추천을 감추지 않는다', () => {
    const markup = render({ ...GOOD_DAY, hourly: [] })

    expect(markup).toContain('18:00')
    expect(markup).not.toContain(messages.home.goldenNoForecast)
  })

  /* 예보가 있고 구간만 없는 기존 케이스는 그대로 위험 단정이다 — 회귀 방지 */
  it('예보가 있고 구간만 없으면 위험 단정을 유지한다', () => {
    const markup = render(BAD_DAY)

    expect(markup).toContain(messages.home.goldenNone)
    expect(markup).not.toContain(messages.home.goldenNoForecast)
  })
})

describe('WalkTimesSection — 상태', () => {
  it('조회 실패는 섹션을 통째로 숨긴다 — 홈 최소 골격에 이 섹션은 없다', () => {
    expect(render(null)).toBe('')
  })

  it('로딩 중에는 skeleton 만 보이고 값이 함께 나오지 않는다', () => {
    const markup = render(null, true)

    expect(markup).toContain('animate-pulse')
    expect(markup).not.toContain('18:00')
  })

  it('특보 배지를 함께 그린다', () => {
    expect(render(BAD_DAY)).toContain('경보')
    expect(render(GOOD_DAY)).not.toContain('경보')
  })

  /*
    곡선은 좌표에 딸린 값이라 **어디 기준인지 모르면 읽을 수 없다.** 위치를 얻었는지에
    따라 기준이 달라지므로 둘을 구분해 적는다 (#180).
  */
  it('현재 위치로 조회했으면 그렇게 적는다', () => {
    const markup = render(GOOD_DAY)

    expect(markup).toContain(messages.home.goldenBasisCurrent)
    expect(markup).not.toContain(messages.home.goldenBasis)
  })

  it('위치를 못 얻었으면 제주시 기준임을 감추지 않는다', () => {
    const markup = render(GOOD_DAY, false, true)

    expect(markup).toContain(messages.home.goldenBasis)
    expect(markup).not.toContain(messages.home.goldenBasisCurrent)
  })
})

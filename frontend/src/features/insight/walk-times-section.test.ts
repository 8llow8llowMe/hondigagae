import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { WalkTimesSection } from '@/features/insight/walk-times-section'
import { mockWalkTimes } from '@/lib/api/mock/insight-data'
import { messages } from '@/lib/messages'
import type { WalkTimesResponse } from '@/types/insight'

function render(
  data: WalkTimesResponse | null,
  loading = false,
  positionFallback = false,
  onRetry?: () => void,
) {
  return renderToStaticMarkup(
    createElement(WalkTimesSection, {
      data,
      loading,
      positionFallback,
      ...(onRetry === undefined ? {} : { onRetry }),
    }),
  )
}

/*
  mock 은 반려견 조건 **둘**로 네 날을 가른다 (#262) — 판정 자리의 상태가 넷인데
  `heatSensitive` 하나로는 두 갈래가 한계다. 조합표는 `mockWalkTimes` 머리주석에 있다.
*/
/** 골든타임이 있는 날 — 초코 조합 */
const GOOD_DAY = mockWalkTimes({ heatSensitive: false, coldSensitive: true, noiseSensitive: false })
/**
 * 특보 **경보**로 추천이 **보류**된 날 — 몽실이 조합 (#270).
 *
 * **`ALL_RISKY_DAY` 와 다른 상태다.** 서버는 예보 → 경보 → 구간 순으로 보므로 경보가
 * 떠 있으면 곡선이 어떻든 `SUPPRESSED_BY_WARNING` 이다. 예전 fixture 는 이 둘을 하나로
 * 묶어 두어, 화면이 보류를 위험 단정으로 말하는 것을 테스트가 오히려 고정하고 있었다.
 */
const SUPPRESSED_DAY = mockWalkTimes({
  heatSensitive: true,
  coldSensitive: false,
  noiseSensitive: true,
})
/** 경보 없이 남은 시각이 전부 위험한 날 — `goldenNone` 이 참인 유일한 상태 */
const ALL_RISKY_DAY = mockWalkTimes({
  heatSensitive: true,
  coldSensitive: false,
  noiseSensitive: false,
})
/** 곡선이 비었고 **정상**인 날 (그 날짜 예보 시간대가 지났다) */
const DAY_ENDED = mockWalkTimes({
  heatSensitive: false,
  coldSensitive: false,
  noiseSensitive: false,
})
/** 곡선이 비었고 **장애**인 날 (날씨를 못 받았다) */
const UNAVAILABLE = mockWalkTimes({
  heatSensitive: true,
  coldSensitive: true,
  noiseSensitive: false,
})

describe('WalkTimesSection — 추천 구간', () => {
  it('골든타임을 시각 문장으로 적는다 — 곡선 색에만 기대지 않는다', () => {
    const markup = render(GOOD_DAY)

    expect(markup).toContain('18:00')
    expect(markup).toContain('21:00')
  })

  /*
    **시각과 등급어는 같은 색이어야 한다.** 예전에는 시각 쪽이 `text-metric-high-700`
    (초록) 하드코딩이라, 추천 구간의 등급이 `CAUTION` 인 날 초록 시각 옆에 황갈색 "주의"
    가 섰다 — 한 줄 안에서 색 두 개가 서로 다른 말을 했다.

    `CAUTION` 으로 고정해 검사한다. 톤이 갈리는 것을 보려면 **초록이 아닌 등급**이어야
    한다 — `SAFE` 로 두면 옛 하드코딩도 우연히 통과한다.
  */
  const CAUTION_GOLDEN: WalkTimesResponse = {
    ...GOOD_DAY,
    goldenLevel: { code: 'CAUTION', name: '주의', description: null, scoreDescription: null },
  }

  /*
    **헤드라인 한 줄만 떼어 본다** (#312). 예전에는 마크업 전체에 `not.toContain` 을 걸어
    두었는데, 곡선 셀의 노면 숫자가 등급 색을 갖게 되면서 그 단정이 무너졌다 — 그 색은
    이 줄과 무관한 다른 자리의 사실이다. 검사 대상은 처음부터 이 한 줄이었다.

    **`text-body-1` 이 아니라 `text-title-1` 로 찾는다** (#637). 예전에는 배지를 담으려고
    `text-body-1` flex 줄 안에 시각 span 이 들어 있었는데, 배지가 빠지면서 감쌀 것이
    없어졌다 — 시각이 곧 그 줄이다. 아래 등급 문장이 `text-body-1` 을 쓴다.
  */
  function headlineLine(markup: string): string {
    return /<p class="text-title-1[^>]*>.*?<\/p>/.exec(markup)?.[0] ?? ''
  }

  it('추천 시각이 구간의 등급 색을 쓴다', () => {
    const line = headlineLine(render(CAUTION_GOLDEN))

    expect(line).toContain('18:00')
    expect(line).toContain('text-metric-mid-700')
    expect(line).not.toContain('text-metric-high-700')
  })

  /* `-500` 은 22px + weight 900 전용이다. 이 시각은 700 이라 글자 층(`-700`)을 쓴다 */
  it('추천 시각에 -500 층을 쓰지 않는다', () => {
    expect(render(CAUTION_GOLDEN)).not.toContain('text-metric-mid-500')
  })

  /*
    #312 — 곡선의 세로 막대는 `h-8 w-2` 고정이라 **길이가 변하지 않으면서 막대의 형태**를
    하고 있었다. DESIGN.md §10 이 이미 금지한 것이고(장식성 세로 바는 `ReasonList` 3px 바에만),
    그 색은 문장이 가리키는 추천 구간으로 옮겼다.
  */
  it('장식성 세로 막대를 그리지 않는다', () => {
    const markup = render(GOOD_DAY)

    expect(markup).not.toContain('h-8 w-2')
    expect(markup).not.toContain('bg-metric-high-500')
  })

  it('추천 구간에 드는 셀에만 tint 면을 준다', () => {
    // GOOD_DAY 는 18:00 – 21:00 추천이고 곡선은 14시부터다
    const cells = render(GOOD_DAY).split('<li ').slice(1)

    expect(cells).toHaveLength(8)
    expect(cells.map((cell) => cell.includes('bg-metric-'))).toEqual([
      false, // 14시
      false, // 15시
      false, // 16시
      false, // 17시
      true, //  18시 — 구간 시작
      true, //  19시
      true, //  20시
      true, //  21시 — 구간 끝
    ])
  })

  /* 면과 숫자가 다 색이라 스크린리더에는 아무 말도 못 한다 — 낱말을 남긴다 */
  it('등급 이름을 sr-only 로 남긴다', () => {
    expect(render(GOOD_DAY)).toContain('<span class="sr-only">안전</span>')
  })

  /* 추천이 없는 날에 화면이 구간을 만들어 내지 않는다 */
  it('추천 구간이 없으면 어느 셀에도 면을 주지 않는다', () => {
    const markup = render({ ...GOOD_DAY, goldenStart: null, goldenEnd: null, goldenLevel: null })

    expect(markup).not.toContain('bg-metric-')
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
    const markup = render(ALL_RISKY_DAY)

    expect(markup).toContain(messages.home.goldenNone)
    expect(markup).not.toContain('18:00')
    expect(markup).not.toContain('–')
  })

  it('추천이 없어도 곡선은 그대로 보여 준다 — 근거를 감추지 않는다', () => {
    for (const markup of [render(ALL_RISKY_DAY), render(SUPPRESSED_DAY)]) {
      expect(markup).toContain('14시')
      expect(markup).toContain('21시')
    }
  })
})

describe('WalkTimesSection — 곡선', () => {
  /*
    #269. **예전에는 숫자가 하나뿐이라 노면온도를 기온으로 읽었다** — 기온 29℃ 인 날
    `56.0℃` 만 보고 "온도가 잘못된 것 같다" 는 제보가 왔다. `temperature` 는 응답에 이미
    있었는데 화면이 버리고 있었다.
  */
  it('시각·기온·노면온도를 함께 둔다 — 색만으로 정보를 전달하지 않는다 (DESIGN.md §2-3)', () => {
    const markup = render(GOOD_DAY)
    const first = GOOD_DAY.hourly[0]

    expect(markup).toContain('14시')
    // `formatCelsius` 는 소수점 1자리를 유지한다 — 목록에서 자릿수가 흔들리지 않게
    expect(markup).toContain(`${first?.temperature.toFixed(1)}℃`)
    expect(markup).toContain(`${first?.estimatedPavementCelsius.toFixed(1)}℃`)
    // 두 값이 실제로 다른 fixture 여야 이 단언이 뜻을 갖는다
    expect(first?.temperature).not.toBe(first?.estimatedPavementCelsius)
  })

  /*
    3rem 폭에 `기온 29℃` 는 들어가지 않아 **눈으로는 위치가** 둘을 가른다. 그 위치가
    무엇인지는 낱말이 말해야 한다 — 보조기기에는 셀 안의 라벨이, 눈에는 곡선 **왼쪽의
    행 라벨 열**이 간다. 자리와 색만으로 전달하지 않는다.

    예전에는 눈에 가는 쪽이 곡선 아래 범례 한 줄이었다. 읽고 다시 위로 올라와 대응시켜야
    했고, `노면(아스팔트)` 의 괄호가 항목 둘로 읽혔다.
  */
  it('두 온도가 무엇인지 낱말로도 말한다', () => {
    const markup = render(GOOD_DAY)

    expect(markup).toContain(messages.home.temperatureLabel)
    expect(markup).toContain(messages.home.pavementLabel)
    expect(markup).toContain(messages.home.goldenCurveRowTemperature)
    expect(markup).toContain(messages.home.goldenCurveRowPavement)
  })

  /* 라벨은 낱말만 남긴다 — 괄호가 붙으면 노면과 아스팔트가 두 가지로 읽힌다 */
  it('행 라벨에는 괄호를 달지 않는다', () => {
    expect(messages.home.goldenCurveRowPavement).not.toContain('(')
  })

  /* "노면" 만으로는 흙길·잔디를 떠올린다. 이 추정식은 아스팔트 기준이다 */
  it('노면이 아스팔트임을 밝힌다', () => {
    for (const text of [messages.home.pavementLabel, messages.home.goldenPavementNote]) {
      expect(text).toContain('아스팔트')
    }
  })

  /*
    행 라벨은 **곡선을 설명하는 낱말**이다. 곡선이 없는 날에 남으면 없는 숫자의 자리를
    말하게 된다 — `HourlyCurve` 안에 두어 곡선과 함께 사라지게 했다.

    **낱말로 확인하지 않는다.** `기온`·`노면` 은 셀의 `sr-only` 라벨과 하단 캡션
    (`goldenPavementNote` — "노면(아스팔트) 온도는 추정치예요")에도 들어 있어, 곡선이
    없어도 문자열은 남는다. 실제로 이 테스트를 낱말로 썼다가 그 캡션에 걸렸다.

    그래서 **곡선 자체가 없는지**를 본다. `scroll-rail` 은 이 곡선에만 붙는 클래스라
    라벨 열·셀·화살표가 한꺼번에 사라졌음을 한 줄로 말한다.
  */
  it('곡선이 없으면 행 라벨도 렌더하지 않는다', () => {
    const markup = render(DAY_ENDED)

    expect(markup).not.toContain('scroll-rail')
    expect(markup).toContain(messages.home.goldenPavementNote)
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
    특보가 있는 `SUPPRESSED_DAY` 를 베이스로 쓰지 않는 이유는 특보 배지 자체가 위험 톤을 쓰기
    때문이다: 그러면 아래 톤 검사가 판정 자리를 보는지 배지를 보는지 알 수 없어진다.
  */
  const NO_FORECAST: WalkTimesResponse = {
    ...GOOD_DAY,
    hourly: [],
    goldenStart: null,
    goldenEnd: null,
    goldenLevel: null,
    // 옛 서버 모양 — 이 필드가 없던 시절이다 (#262). 그때는 우리 문구로 떨어진다
    forecastCoverage: null,
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
    expect(render(ALL_RISKY_DAY)).toContain('text-metric-critical-700')
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

  /* 경보 없이 구간만 없는 경우는 그대로 위험 단정이다 — 회귀 방지 */
  it('예보가 있고 구간만 없으면 위험 단정을 유지한다', () => {
    const markup = render(ALL_RISKY_DAY)

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

  /*
    **스켈레톤이 카드 안에서 자기 배경을 갖지 않는다** (`DESIGN.md §0`, #475). 지운 2a
    `Band` 의 출력(`bg-band h-2 w-full`)이 이 스켈레톤 끝에 하나 남아 있었다 — 카드 안
    마지막 자식이라 각진 불투명 면이 radius 12 모서리를 덮는다. 일정 상세·목록·응급·장소
    상세가 이미 같은 단언으로 막아 뒀고, 홈에서 마지막 한 자리가 이 파일이었다.

    **인셋도 실제 섹션과 같아야 한다.** `rail`(16/40)이었어서 로딩이 끝나는 순간 글줄이
    20px 뛰었다 — 실제 섹션은 `px-4 md:px-5` 다.
  */
  it('로딩 스켈레톤이 8px 밴드를 그리지 않고 인셋이 실제 섹션과 같다', () => {
    const markup = render(null, true)

    expect(markup).not.toContain('bg-band h-2')
    expect(markup).toContain('px-4 md:px-5')
    expect(markup).not.toContain('md:px-10')
  })

  it('특보 배지를 함께 그린다', () => {
    expect(render(SUPPRESSED_DAY)).toContain('경보')
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

/*
  #262. **곡선이 비는 이유는 하나가 아니다.** 서버 `forecastCoverage` 가 갈라 준다 —
  `DAY_ENDED` 는 정상(자정 이후 다시 채워진다)이고 `UNAVAILABLE` 만 다시 시도할 일이다.
  전에는 둘을 같은 문장으로 말했다: **고칠 수 있는 상태를 고칠 수 없는 것처럼** 말한 것이다.
*/
describe('WalkTimesSection — 곡선이 빈 이유 (#262)', () => {
  it('서버 문구를 그대로 쓴다 — FE 에 한국어 매핑 테이블을 두지 않는다', () => {
    const markup = render(DAY_ENDED)
    const coverage = DAY_ENDED.forecastCoverage

    expect(coverage?.code).toBe('DAY_ENDED')
    expect(markup).toContain(coverage?.name)
    expect(markup).toContain(coverage?.description)
    // 우리 문구로 덮어쓰지 않는다
    expect(markup).not.toContain(messages.home.goldenNoForecast)
  })

  it('장애와 정상이 다른 문구를 받는다', () => {
    const ended = render(DAY_ENDED)
    const failed = render(UNAVAILABLE)

    expect(UNAVAILABLE.forecastCoverage?.code).toBe('UNAVAILABLE')
    expect(ended).not.toContain(UNAVAILABLE.forecastCoverage?.name)
    expect(failed).not.toContain(DAY_ENDED.forecastCoverage?.name)
  })

  /*
    `DAY_ENDED` 는 자정 전에는 몇 번을 눌러도 같은 응답이다 — 고칠 수 없는 것에 버튼을
    달면 사용자가 계속 누른다. `404` 에 재시도를 달지 않는 규칙과 같은 축이다.
  */
  it('UNAVAILABLE 에만 재시도를 준다', () => {
    expect(render(UNAVAILABLE, false, false, () => undefined)).toContain(messages.common.retry)
    expect(render(DAY_ENDED, false, false, () => undefined)).not.toContain(messages.common.retry)
  })

  it('onRetry 가 없으면 UNAVAILABLE 이어도 버튼을 렌더하지 않는다', () => {
    expect(render(UNAVAILABLE)).not.toContain(messages.common.retry)
  })

  /*
    옛 서버(필드가 없던 시절)와 `AVAILABLE` 인데 곡선이 빈 경우. 뒤쪽은 오지 않아야 하지만
    오면 `예보 있음` 이라는 제목 아래 아무것도 없는 자리가 된다 — 그때는 우리 문구로
    "모른다" 고 말한다.
  */
  it('forecastCoverage 가 없으면 예전 문구로 떨어진다', () => {
    const markup = render({ ...DAY_ENDED, forecastCoverage: null })

    expect(markup).toContain(messages.home.goldenNoForecast)
    expect(markup).toContain(messages.home.goldenNoForecastDesc)
  })

  it('AVAILABLE 인데 곡선이 비면 "예보 있음" 이라고 말하지 않는다', () => {
    const markup = render({
      ...DAY_ENDED,
      forecastCoverage: { code: 'AVAILABLE', name: '예보 있음', description: '있습니다.' },
    })

    expect(markup).not.toContain('예보 있음')
    expect(markup).toContain(messages.home.goldenNoForecast)
  })

  /*
    **곡선이 있으면 이 자리를 쓰지 않는다.** `forecastCoverage` 를 먼저 보게 바꾸면
    `AVAILABLE` 이 아닌 코드가 왔을 때 실제로 있는 곡선과 추천을 감춘다.
  */
  it('곡선이 있으면 coverage 문구가 나오지 않는다', () => {
    const markup = render({
      ...GOOD_DAY,
      forecastCoverage: UNAVAILABLE.forecastCoverage,
    })

    expect(markup).not.toContain(UNAVAILABLE.forecastCoverage?.name)
    expect(markup).toContain('18:00')
  })
})

/*
  #270. **`goldenStart: null` 에 성질이 다른 셋이 섞여 있었다.** 화면이 불린 둘로 갈라
  그중 하나의 문구를 나머지에도 썼고, 풍랑경보 날 곡선에는 저녁 안전 구간이 초록으로
  그려져 있는데 "남은 시간이 모두 위험 등급이에요" 가 나갔다.
*/
describe('WalkTimesSection — 골든타임이 없는 이유 (#270)', () => {
  it('경보 보류와 위험 단정이 다른 문구를 받는다', () => {
    const suppressed = render(SUPPRESSED_DAY)
    const risky = render(ALL_RISKY_DAY)

    expect(suppressed).toContain(messages.home.goldenSuppressed)
    expect(risky).toContain(messages.home.goldenNone)
    // 서로의 문구를 쓰지 않는다 — 이 이슈의 제보가 정확히 그것이었다
    expect(suppressed).not.toContain(messages.home.goldenNone)
    expect(risky).not.toContain(messages.home.goldenSuppressed)
  })

  /*
    **보류는 판정이 아니다.** 곡선에 안전 구간이 남아 있고 그것을 근거로 그대로 보여 주므로,
    전부 위험과 같은 색을 주면 두 상태가 다시 한 덩어리로 읽힌다.
  */
  it('보류에는 위험 톤을 쓰지 않는다 (DESIGN.md §2-3)', () => {
    const suppressed = render(SUPPRESSED_DAY)

    // 특보 배지가 위험 톤을 쓰므로 판정 문구 자체에 톤이 없는지를 본다
    expect(suppressed).not.toContain(
      `text-metric-critical-700 font-semibold">${messages.home.goldenSuppressed}`,
    )
    expect(render(ALL_RISKY_DAY)).toContain('text-metric-critical-700')
  })

  it('보류에도 곡선은 그대로 남는다 — 근거를 감추지 않는다', () => {
    const markup = render(SUPPRESSED_DAY)

    expect(markup).toContain('14시')
    expect(markup).toContain(messages.home.goldenCurveRowPavement)
  })

  /*
    **판정 순서를 화면이 다시 짜지 않는다.** 서버 `GoldenWindowStatus.of` 가 예보 → 경보 →
    구간 순으로 정한다. 서버가 `SUPPRESSED_BY_WARNING` 이라고 하면 곡선에 구간이 보여도
    보류다 — 화면이 곡선을 다시 읽어 뒤집으면 두 규칙이 갈린다.
  */
  it('서버 상태가 곡선보다 우선한다', () => {
    const markup = render({
      ...GOOD_DAY,
      goldenWindowStatus: SUPPRESSED_DAY.goldenWindowStatus,
      goldenStart: null,
      goldenEnd: null,
      goldenLevel: null,
    })

    expect(markup).toContain(messages.home.goldenSuppressed)
    expect(markup).toContain('14시')
  })

  /*
    **모르는 코드에서 화면이 비지 않는다.** 서버가 하나를 더 내면 `NO_FORECAST` 로 떨어져
    "예보 없음" 을 말하게 되는데, 곡선이 있는 날에 그것은 거짓이다 — 옛 갈래로 내려가
    아는 만큼만 말한다.
  */
  it('모르는 코드는 옛 갈래로 떨어진다', () => {
    const markup = render({
      ...ALL_RISKY_DAY,
      goldenWindowStatus: { code: 'FUTURE_CODE', name: '미래', description: '모르는 값' },
    })

    expect(markup).toContain(messages.home.goldenNone)
    expect(markup).not.toContain(messages.home.goldenNoForecast)
  })

  /*
    **옛 서버(필드 없음)에서 예전 세 갈래 그대로다.** `weatherWarning` 을 보고 보류를
    만들어 내지 않는다 — 경보와 주의보를 가르는 규칙까지 화면이 복제하게 된다.
  */
  it('goldenWindowStatus 가 없으면 예전 세 갈래로 떨어진다', () => {
    expect(render({ ...GOOD_DAY, goldenWindowStatus: null })).toContain('18:00')
    expect(render({ ...ALL_RISKY_DAY, goldenWindowStatus: null })).toContain(
      messages.home.goldenNone,
    )
    expect(render({ ...DAY_ENDED, goldenWindowStatus: null })).toContain(
      DAY_ENDED.forecastCoverage?.name as string,
    )
  })

  /* `AVAILABLE` 인데 구간이 없으면 그릴 것이 없다 — 빈 자리를 만들지 않는다 */
  it('AVAILABLE 인데 구간이 없으면 옛 갈래로 떨어진다', () => {
    const markup = render({
      ...ALL_RISKY_DAY,
      goldenWindowStatus: GOOD_DAY.goldenWindowStatus,
    })

    expect(markup).toContain(messages.home.goldenNone)
  })
})

/*
  #637. **헤드라인 옆 배지가 창 전체의 등급으로 읽혔다.** `11:00 – 23:00 [주의]` 는
  "좋은 시간이라면서 주의?" 라는 모순이고, 실제로 주의는 창 안의 두 칸(14 · 15시)이었다
  (2026-09-15 dev 실측). 배지가 가진 정보는 원래 **어디가 주의인가** 인데 배지에는 그것을
  적을 자리가 없다 — 그 자리를 문장으로 옮겼다.
*/
describe('WalkTimesSection — 창 안 등급 문장 (#637)', () => {
  const DAY = '2026-08-29T'

  function walkHour(hh: number, code: string, name: string, pavement: number) {
    return {
      at: `${DAY}${String(hh).padStart(2, '0')}:00:00`,
      walkSafetyLevel: { code, name, description: null, scoreDescription: null },
      temperature: 30,
      estimatedPavementCelsius: pavement,
      precipitationProbability: 0,
    }
  }

  /** 실측의 모양 — 창은 11–23 이고 그 안에서 14 · 15 만 주의다 */
  const MIXED_DAY: WalkTimesResponse = {
    ...GOOD_DAY,
    hourly: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23].map((hh) =>
      hh === 14 || hh === 15
        ? walkHour(hh, 'CAUTION', '주의', hh === 15 ? 46.3 : 45.9)
        : walkHour(hh, 'SAFE', '안전', 32),
    ),
    goldenStart: `${DAY}11:00:00`,
    goldenEnd: `${DAY}23:00:00`,
    goldenLevel: { code: 'CAUTION', name: '주의', description: null, scoreDescription: null },
  }

  /*
    **배지는 창 하나에 등급 하나를 붙인다.** 그 모양으로는 "창 안 어디가 주의인가" 를
    말할 수 없어서 사용자가 창 전체를 주의로 읽었다 — 이 이슈의 제보가 그것이다.
  */
  it('헤드라인 줄에 등급 배지를 세우지 않는다', () => {
    const line = headlineOf(render(MIXED_DAY))

    expect(line).toContain('11:00 – 23:00')
    expect(line).not.toContain('주의')
    // `MetricWord` 의 고정 크기 (20/800). 이 줄에 배지가 남으면 여기서 걸린다
    expect(line).not.toContain('text-emphasis')
  })

  it('창 안의 주의 구간과 노면 최고온도를 문장으로 말한다', () => {
    const markup = render(MIXED_DAY)

    expect(markup).toContain('14–15시는 노면이 46℃까지 올라')
    // 등급어가 색을 받는 span 안에 있어 마크업에서는 문장이 끊긴다
    expect(markup).toContain('주의 등급</span>이에요.')
  })

  /* 곡선이 좋은 구간을 면으로 보여 주지만, 색만으로 말하지 않는다 (DESIGN.md §2-3) */
  it('창 안의 좋은 구간을 이어서 말한다', () => {
    expect(render(MIXED_DAY)).toContain('11–13시 · 16–23시가 좋아요.')
  })

  /* 소수는 곡선 셀(표)의 것이다. 문장에 들어오면 데이터 냄새가 난다 (진단 G-2) */
  it('문장 속 노면온도에 소수를 쓰지 않는다', () => {
    expect(render(MIXED_DAY)).not.toContain('46.3℃까지')
  })

  /*
    **등급어에만 색을 준다.** 문장이 낱말로 먼저 말하고 색은 어디가 등급어인지 눈이 잡게
    돕는 보조 채널이다 — `-700` 층이라 16px 글자에서 대비가 선다 (`METRIC_WORD_TONE`).
  */
  it('등급어에 등급 톤을 준다', () => {
    expect(render(MIXED_DAY)).toContain('text-metric-mid-700">주의 등급</span>')
  })

  it('창 안 등급이 하나뿐이면 내내 그 등급이라고 말한다', () => {
    // GOOD_DAY 의 창(18–21)은 전부 안전이다
    expect(render(GOOD_DAY)).toContain('이 시간대는 내내 ')
    expect(render(GOOD_DAY)).toContain('안전 등급</span>이에요')
    expect(render(GOOD_DAY)).not.toContain('좋아요.')
  })

  /*
    **서버가 준 등급 이름을 그대로 쓴다.** 창 안이 전부 주의인 날에도 FE 가 한국어를
    고르지 않는다 — messages 에 `주의` 가 들어가면 서버가 이름을 고쳐도 화면은 옛 이름을 말한다.
  */
  it('창 안이 전부 주의여도 서버 이름을 그대로 쓴다', () => {
    const markup = render({
      ...MIXED_DAY,
      hourly: [11, 12, 13].map((hh) => walkHour(hh, 'CAUTION', '주의', 46)),
      goldenEnd: `${DAY}13:00:00`,
    })

    expect(markup).toContain('이 시간대는 내내 ')
    expect(markup).toContain('주의 등급</span>이에요')
  })

  /* 한 칸을 "내내" 라고 말할 수 없다. 그 칸의 등급은 곡선 셀이 이미 전한다 (#200) */
  it('한 시각짜리 창에는 문장을 붙이지 않는다', () => {
    const at = `${DAY}23:00:00`
    const markup = render({ ...MIXED_DAY, goldenStart: at, goldenEnd: at })

    expect(markup).toContain(messages.home.goldenSingleHour.replace('{time}', '23:00'))
    expect(markup).not.toContain('등급이에요')
  })

  /* 응답이 어긋난 날. 사용자가 할 일이 있는 상태가 아니므로 조용히 헤드라인만 남긴다 */
  it('창 안 시각이 하나도 없으면 문장 없이 헤드라인만 남긴다', () => {
    const markup = render({ ...MIXED_DAY, hourly: [] })

    expect(markup).toContain('11:00 – 23:00')
    expect(markup).not.toContain('등급이에요')
  })

  /*
    **D4-2.** 390px 에서 두 문장이 세 줄이 되면 문장이 헤드라인보다 커 보인다. 넘으면
    뒤 문장을 뺀다 — 곡선이 좋은 구간을 면으로 이미 보여 준다 (홈-세부명세 D4-1-c).
  */
  it('두 문장이 너무 길면 좋은 구간 문장을 뺀다', () => {
    const markup = render({
      ...MIXED_DAY,
      hourly: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23].map((hh) =>
        hh % 2 === 0 && hh <= 18
          ? walkHour(hh, 'CAUTION', '주의', 46)
          : walkHour(hh, 'SAFE', '안전', 32),
      ),
    })

    expect(markup).toContain('노면이 46℃까지 올라')
    expect(markup).not.toContain('좋아요.')
  })

  /*
    **`{level}` 은 FE 가 쓰지 않는다** (`frontend/CLAUDE.md` enum 규칙). 서버가 등급 이름을
    고치면 화면이 그대로 따라야 하는데, messages 에 한국어 등급어가 박히면 옛 이름이 남는다.
  */
  it('문구에 한국어 등급어를 박아 두지 않는다', () => {
    for (const template of [messages.home.goldenAllSafe, messages.home.goldenCautionRuns]) {
      expect(template).toContain('{level}')
      for (const level of ['안전', '주의', '위험']) {
        expect(template).not.toContain(level)
      }
    }
  })

  /*
    **강조는 `{level} 등급` 조각을 찾아 건다.** 템플릿에서 그 조각이 사라지면 색이 조용히
    빠지고 문장은 멀쩡해 보인다 — 눈으로는 못 잡는 종류의 회귀라 여기서 고정한다.
  */
  it('두 문구 모두 등급어 조각을 담는다', () => {
    expect(messages.home.goldenAllSafe).toContain('{level} 등급')
    expect(messages.home.goldenCautionRuns).toContain('{level} 등급')
  })

  function headlineOf(markup: string): string {
    return /<p class="text-title-1[^>]*>.*?<\/p>/.exec(markup)?.[0] ?? ''
  }
})

/*
  #656. **추천 구간 면이 단색 한 톤이었다.** `goldenLevel` 하나로 구간 전체를 칠했으므로
  창 안에서 시각별로 안전도가 갈리는 것이 면에는 한 번도 나타나지 않았다 — #637 이 같은
  사실을 문장으로 말하게 만든 뒤에도 그림은 옛말을 했다.

  면은 이제 **칸마다의 `walkSafetyLevel`** 로 칠한다.
*/
describe('WalkTimesSection — 곡선 면의 시각별 등급 (#656)', () => {
  const DAY = '2026-08-29T'

  function walkHour(hh: number, code: string, name: string, pavement: number) {
    return {
      at: `${DAY}${String(hh).padStart(2, '0')}:00:00`,
      walkSafetyLevel: { code, name, description: null, scoreDescription: null },
      temperature: 30,
      estimatedPavementCelsius: pavement,
      precipitationProbability: 0,
    }
  }

  /** 실측의 모양 — 창은 11–23 이고 그 안에서 14 · 15 만 주의다 (#637 과 같은 날) */
  const MIXED_DAY: WalkTimesResponse = {
    ...GOOD_DAY,
    hourly: [11, 12, 13, 14, 15, 16, 17].map((hh) =>
      hh === 14 || hh === 15
        ? walkHour(hh, 'CAUTION', '주의', 46)
        : walkHour(hh, 'SAFE', '안전', 32),
    ),
    goldenStart: `${DAY}11:00:00`,
    goldenEnd: `${DAY}17:00:00`,
    goldenLevel: { code: 'CAUTION', name: '주의', description: null, scoreDescription: null },
  }

  /** 셀마다 어떤 면을 받았는지. 면이 없으면 `null` */
  const FILLS = [
    'bg-metric-critical-100',
    'bg-metric-high-100',
    'bg-metric-mid-100',
    'bg-metric-low-100',
    'bg-band',
  ]

  function fillsOf(markup: string): (string | null)[] {
    return markup
      .split('<li ')
      .slice(1)
      .map((cell) => cell.slice(0, cell.indexOf('>')))
      .map((head) => FILLS.find((fill) => head.includes(fill)) ?? null)
  }

  /*
    **이 단언이 이슈 그 자체다.** 예전 화면은 창 전체를 `goldenLevel`(주의) 한 톤으로 칠해
    아래 7칸이 전부 `bg-metric-mid-100` 이었다 — 11–13시가 안전이라는 사실이 면에 없었다.
  */
  it('창 안을 시각별 등급으로 칠한다', () => {
    expect(fillsOf(render(MIXED_DAY))).toEqual([
      'bg-metric-high-100', // 11시 안전
      'bg-metric-high-100', // 12시
      'bg-metric-high-100', // 13시
      'bg-metric-mid-100', //  14시 주의
      'bg-metric-mid-100', //  15시 주의
      'bg-metric-high-100', // 16시 안전
      'bg-metric-high-100', // 17시
    ])
  })

  /*
    **`goldenLevel` 은 더 이상 면을 정하지 않는다.** 창 안이 전부 안전인데 서버가 창 등급을
    `CAUTION` 으로 주는 날(반올림·다른 기준)에 면이 통째로 황갈색이 되면, 곡선과 문장이
    서로 다른 말을 하는 #270 의 실패가 다시 난다.
  */
  it('창 등급이 아니라 칸의 등급으로 칠한다', () => {
    const allSafeWindow: WalkTimesResponse = {
      ...MIXED_DAY,
      hourly: [11, 12, 13].map((hh) => walkHour(hh, 'SAFE', '안전', 32)),
      goldenEnd: `${DAY}13:00:00`,
    }

    expect(fillsOf(render(allSafeWindow))).toEqual([
      'bg-metric-high-100',
      'bg-metric-high-100',
      'bg-metric-high-100',
    ])
  })

  /*
    **단일 등급 회귀.** 창 안이 한 등급뿐인 날은 예전과 똑같이 한 면이어야 한다 — 칸마다
    칠한다고 해서 같은 등급이 이어지는 자리에 색이 갈리면 안 된다.
  */
  it('창 안 등급이 하나뿐이면 예전처럼 한 톤으로 이어진다', () => {
    // GOOD_DAY 는 18:00 – 21:00 추천이고 그 네 칸이 전부 안전이다
    expect(fillsOf(render(GOOD_DAY))).toEqual([
      null, //                14시
      null, //                15시
      null, //                16시
      null, //                17시
      'bg-metric-high-100', // 18시
      'bg-metric-high-100', // 19시
      'bg-metric-high-100', // 20시
      'bg-metric-high-100', // 21시
    ])
  })

  /*
    **면을 잇는 것은 라운드 없음과 `gap` 없음이다.** 칸 사이를 `gap` 으로 벌리거나 셀에
    모서리를 깎으면 같은 등급이 이어지는 칸 사이에 흰 틈이 생겨 한 면으로 안 읽힌다 (#312).
    칸마다 칠하는 지금은 그것이 더 중요하다 — 틈이 있으면 "등급이 갈리는 자리" 와 구별되지 않는다.
  */
  it('같은 등급이 이어지는 칸 사이에 경계를 만들지 않는다', () => {
    const markup = render(MIXED_DAY)
    const cells = markup
      .split('<li ')
      .slice(1)
      .map((cell) => cell.slice(0, cell.indexOf('>')))

    for (const head of cells) {
      expect(head).not.toContain('rounded')
      expect(head).not.toContain('border')
    }

    // 셀을 담는 `<ul>` 에 `gap` 이 없다 — 간격은 셀 안쪽 padding 이 준다
    const list = /<ul [^>]*class="([^"]*)"/.exec(markup)?.[1] ?? ''
    expect(list).not.toContain('gap-')
  })

  /*
    **창 밖은 등급이 무엇이든 면이 없다.** 면이 말하는 첫째 사실은 "서버가 추천한 구간" 이고,
    칸마다 칠하게 됐다고 해서 곡선 전체가 등급 히트맵이 되면 추천 구간이 사라진다.
  */
  it('창 밖 칸은 위험 등급이어도 면을 받지 않는다', () => {
    // GOOD_DAY 의 14 · 15 · 16시는 노면 50℃ 이상이라 DANGER 인데 창(18–21) 밖이다
    expect(render(GOOD_DAY)).not.toContain('bg-metric-critical-100')
  })

  /*
    **등급을 모르는 칸.** 등급 색을 주지 않는다 (DESIGN.md §2-3 — `UNKNOWN` 에는 tint 가 없다).
    그렇다고 비우면 그 칸이 창 밖으로 읽혀 문장이 적은 시각과 면이 어긋나므로, 등급을 말하지
    않는 중립 면으로 자리만 지킨다. 모른다는 사실은 노면 숫자의 `--fg-muted` 와 `sr-only` 가
    낱말로 말한다 — 색이 유일한 채널이 아니다.
  */
  it('등급을 모르는 칸은 등급 색 대신 중립 면을 받는다', () => {
    const unknownHour: WalkTimesResponse = {
      ...MIXED_DAY,
      hourly: [11, 12, 13].map((hh) =>
        hh === 12 ? walkHour(hh, 'UNKNOWN', '정보 없음', 32) : walkHour(hh, 'SAFE', '안전', 32),
      ),
      goldenEnd: `${DAY}13:00:00`,
    }
    const markup = render(unknownHour)

    expect(fillsOf(markup)).toEqual(['bg-metric-high-100', 'bg-band', 'bg-metric-high-100'])
    expect(markup).toContain('<span class="sr-only">정보 없음</span>')
  })
})

/*
  **조건이 없는 조회**(게스트·반려견 미등록)는 기본 갈래다. #262 가 조합 규칙을 넣으면서
  `heatSensitive` 파라미터가 아예 없는 경우가 `false/false` 로 접혀 게스트 홈이 늘
  "예보 없음" 을 보게 됐다 — 브라우저 실측에서 잡았다. 조합은 **시나리오를 고르는 장치**이지
  "조건이 없다" 를 뜻하지 않는다.
*/
describe('mockWalkTimes — 조건이 없는 조회 (#270)', () => {
  it('반려견 조건이 없으면 골든타임이 있는 기본 날이다', () => {
    const guest = mockWalkTimes(null)

    expect(guest.goldenWindowStatus?.code).toBe('AVAILABLE')
    expect(guest.hourly.length).toBeGreaterThan(0)
    expect(render(guest)).toContain('18:00')
  })
})

/**
 * 곡선 화살표가 제목 줄에 선다 — [#730](https://github.com/8llow8llowMe/hondigagae/issues/730).
 *
 * **그려진 화살표로 확인할 수 없다.** `useScrollRail` 은 레이아웃을 재서 `fade` 를 정하는데
 * node 환경에는 레이아웃이 없어 언제나 `none` 이고, 그러면 두 배치 모두 아무것도 안 그린다.
 * 배치 자체의 계약은 `components/scroll-rail.test.ts` 가 렌더로 본다.
 *
 * 여기서 잠그는 것은 **이 섹션이 상태를 들고 곡선에 넘기는가** — 그 연결이 끊기면 화살표가
 * 다시 곡선 위로 돌아가 온도 값을 덮는다 (이 이슈의 제보).
 */
describe('WalkTimesSection — 화살표는 제목 줄이다 (#730)', () => {
  const source = readFileSync(
    fileURLToPath(new URL('./walk-times-section.tsx', import.meta.url)),
    'utf8',
  )

  it('스크롤 상태를 이 섹션이 들고 곡선에 넘긴다', () => {
    expect(source).toContain('useScrollRail<HTMLUListElement>()')
    expect(source).toContain('rail={rail}')
  })

  it('화살표를 흐름 배치로 그린다 — 곡선 위에 띄우지 않는다', () => {
    expect(source).toContain('placement="inline"')
  })

  /** 제목과 화살표가 한 줄이다 — 곡선보다 **위**에 있어야 값을 가리지 않는다 */
  it('화살표가 곡선보다 앞에 온다', () => {
    expect(source.indexOf('<ScrollRailArrows')).toBeLessThan(source.indexOf('<WalkTimesCurve'))
  })
})

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it, vi } from 'vitest'

import type { ScrollRail } from '@/components/scroll-rail'
import { WalkTimesCurve } from '@/components/walk-times-curve'
import { messages } from '@/lib/messages'
import type { HourlyWalkSafetyItem } from '@/types/insight'

/**
 * 승격된 시간대 곡선 (#626) — `features/home` 에서 `src/components/` 로 올라왔다.
 *
 * **홈의 회귀는 `features/home/walk-times-section.test.ts` 가 수정 없이 통과하는 것으로
 * 지킨다.** 이 파일은 승격된 컴포넌트 **자신의 계약**만 본다 — `hourly` 세 칸으로
 * `sr-only` 낱말과 창 안 tint 면을 센다.
 */
function hour(at: string, code: string, name: string): HourlyWalkSafetyItem {
  return {
    at,
    walkSafetyLevel: { code, name, description: null, scoreDescription: null },
    temperature: 26,
    estimatedPavementCelsius: 41.2,
    precipitationProbability: 10,
  }
}

const HOURLY = [
  hour('2026-09-13T17:00:00', 'CAUTION', '주의'),
  hour('2026-09-13T18:00:00', 'SAFE', '안전'),
  hour('2026-09-13T19:00:00', 'SAFE', '안전'),
]

function render(goldenStart: string | null, goldenEnd: string | null) {
  return renderToStaticMarkup(
    createElement(WalkTimesCurve, { hourly: HOURLY, goldenStart, goldenEnd }),
  )
}

describe('WalkTimesCurve — 칸마다 낱말로도 말한다 (DESIGN.md §2-3)', () => {
  it('두 온도가 무엇인지 sr-only 낱말로 붙는다', () => {
    const markup = render(null, null)

    expect(markup).toContain(messages.home.temperatureLabel)
    expect(markup).toContain(messages.home.pavementLabel)
  })

  it('등급 이름을 보조기기에 남긴다 — 화면에서는 색과 숫자가 말한다', () => {
    const markup = render(null, null)

    expect(markup).toContain('>주의<')
    expect(markup).toContain('>안전<')
  })

  it('행 라벨은 aria-hidden 이다 — 같은 낱말이 칸마다 이미 있다', () => {
    const markup = render(null, null)

    expect(markup).toContain(`>${messages.home.goldenCurveRowTemperature}<`)
    expect(markup).toContain('aria-hidden="true"')
  })
})

describe('WalkTimesCurve — 창 안 tint 면 (#312 · #656)', () => {
  it('창에 드는 칸에만 면을 준다', () => {
    const cells = render('2026-09-13T18:00:00', '2026-09-13T19:00:00')
      .split('<li ')
      .slice(1)
      .map((cell) => cell.includes('bg-metric-'))

    expect(cells).toEqual([false, true, true])
  })

  it('창이 없으면 어느 칸에도 면을 주지 않는다', () => {
    const cells = render(null, null).split('<li ').slice(1)

    expect(cells.some((cell) => cell.includes('bg-metric-'))).toBe(false)
  })

  /** 면의 톤은 **칸의 등급**에서 온다 — 창 하나에 한 톤이 아니다 (#656) */
  it('창 안 칸의 등급 색으로 칠한다', () => {
    const markup = render('2026-09-13T17:00:00', '2026-09-13T19:00:00')
    const cells = markup.split('<li ').slice(1)

    expect(cells[0]).toContain('bg-metric-mid-100')
    expect(cells[1]).toContain('bg-metric-high-100')
  })
})

/**
 * **등급이 바뀌는 자리의 1px 선** — [#671](https://github.com/8llow8llowMe/hondigagae/issues/671) **C-1**.
 *
 * 창 안 tint 셋(`#FDECEC` 0.869 · `#FEF4E0` 0.912 · `#E4F0EA` 0.848)은 서로 1.02~1.05:1 이라
 * `filter: grayscale(1)` 로 렌더하면 **경계 하나 없는 한 덩어리**가 된다 — 면이 있다/없다(창
 * 안/밖)는 살아남지만 #656 이 새로 실은 **등급**이 통째로 사라진다. 그 자리를 `-500` 실선이
 * 메운다 (`METRIC_TINT_EDGE_TONE`, tint 위 3.53~3.97:1).
 *
 * **이 파일이 지키는 것은 "어디에 긋는가" 다.** 같은 등급이 이어지는 칸 사이에 선이 생기면
 * 면을 잇는 규칙(#312)이 깨지고, 창 밖에 선이 생기면 짝 없는 색 선이 된다 (DESIGN.md §10).
 */
describe('WalkTimesCurve — 등급 경계선 (#671 C-1)', () => {
  function edgesOf(markup: string): boolean[] {
    return markup
      .split('<li ')
      .slice(1)
      .map((cell) => cell.slice(0, cell.indexOf('>')))
      .map((head) => head.includes('border-s'))
  }

  it('등급이 바뀌는 칸의 시작 모서리에만 선을 긋는다', () => {
    // 17 주의 / 18 · 19 안전 — 창은 전부 덮는다
    const markup = render('2026-09-13T17:00:00', '2026-09-13T19:00:00')

    expect(edgesOf(markup)).toEqual([false, true, false])
  })

  it('선 색은 그 칸의 등급에서 온다 — 표를 손으로 펴지 않는다', () => {
    const cells = render('2026-09-13T17:00:00', '2026-09-13T19:00:00').split('<li ').slice(1)

    // 18시(안전)가 경계를 받았다 — 면과 선이 같은 톤이다
    expect(cells[1]).toContain('bg-metric-high-100')
    expect(cells[1]).toContain('border-metric-high-500')
  })

  /**
   * **창이 시작하는 칸에는 긋지 않는다.** 거기는 면이 있다/없다가 이미 말하는 자리이고,
   * 선을 더하면 "등급이 바뀐 자리" 라는 이 선의 뜻이 흐려진다.
   */
  it('창이 시작하는 칸에는 긋지 않는다', () => {
    // 18 · 19 만 창 안이고, 17(주의) → 18(안전)은 창의 시작이다
    expect(edgesOf(render('2026-09-13T18:00:00', '2026-09-13T19:00:00'))).toEqual([
      false,
      false,
      false,
    ])
  })

  /** **면 없이 선만 쓰지 않는다** (`METRIC_TINT_EDGE_TONE` 은 짝으로 쓰는 표다) */
  it('창이 없는 날에는 어느 칸에도 긋지 않는다', () => {
    expect(edgesOf(render(null, null))).toEqual([false, false, false])
  })
})

/**
 * **중립 면이 무엇인지 낱말로 말한다** — [#671](https://github.com/8llow8llowMe/hondigagae/issues/671) **C-2**.
 *
 * 실측: 초록 18시와 초록 20시 사이에 회색 19시가 끼는데 그 19시의 노면(29.0℃)이 18시(33.0℃)
 * 보다 **낮다** — 더 시원한 칸이 더 나쁜 색처럼 보이니 렌더 고장으로 읽힌다. `정보 없음` 은
 * 여태 `sr-only` 에만 있었다.
 *
 * **점선이 아니라 캡션이다.** 점선은 곡선 주석이 이미 기각한 수단이고(모르는 칸이 이어지면
 * 그 사이에 선이 생겨 "같은 등급은 잇는다" 와 어긋난다), 선례는 장소 상세 혼잡도의
 * **보이는** 캡션이다.
 */
describe('WalkTimesCurve — 중립 면 캡션 (#671 C-2)', () => {
  const WITH_UNKNOWN = [
    hour('2026-09-13T18:00:00', 'SAFE', '안전'),
    hour('2026-09-13T19:00:00', 'UNKNOWN', '판단 근거 부족'),
    hour('2026-09-13T20:00:00', 'SAFE', '안전'),
  ]

  function renderHourly(
    hourly: HourlyWalkSafetyItem[],
    goldenStart: string | null,
    goldenEnd: string | null,
  ) {
    return renderToStaticMarkup(createElement(WalkTimesCurve, { hourly, goldenStart, goldenEnd }))
  }

  it('창 안에 모르는 칸이 있으면 보이는 캡션을 낸다', () => {
    const markup = renderHourly(WITH_UNKNOWN, '2026-09-13T18:00:00', '2026-09-13T20:00:00')

    expect(markup).toContain(messages.home.goldenCurveUnknownNote)
    // `sr-only` 가 아니다 — 눈으로 읽히는 자리에 선다
    expect(markup).toContain(`<p class="text-caption text-fg-muted break-keep">`)
  })

  /** 그 칸이 실제로 중립 면을 받는다 — 캡션이 가리킬 대상이 있다 */
  it('모르는 칸은 등급 색이 아니라 중립 면을 받는다', () => {
    const cells = renderHourly(WITH_UNKNOWN, '2026-09-13T18:00:00', '2026-09-13T20:00:00')
      .split('<li ')
      .slice(1)

    expect(cells[1]).toContain('bg-band')
    expect(cells[1]).not.toContain('bg-metric-')
  })

  it('모르는 칸이 없으면 캡션을 내지 않는다', () => {
    const markup = render('2026-09-13T17:00:00', '2026-09-13T19:00:00')

    expect(markup).not.toContain(messages.home.goldenCurveUnknownNote)
  })

  /**
   * **창 밖의 모르는 칸에는 내지 않는다.** 거기에는 면이 아예 없어 회색으로 보일 것이
   * 없다 — 없는 혼동에 캡션을 달면 거의 모든 날에 뜨고, 뜨는 것이 기본이 되면 실제로
   * 필요한 날에 눈에 띄지 않는다.
   */
  it('모르는 칸이 창 밖이면 캡션을 내지 않는다', () => {
    const markup = renderHourly(WITH_UNKNOWN, '2026-09-13T20:00:00', '2026-09-13T20:00:00')

    expect(markup).not.toContain(messages.home.goldenCurveUnknownNote)
  })
})

describe('WalkTimesCurve — 빈 곡선', () => {
  it('남은 예보가 없으면 아무것도 그리지 않는다 — 판정 자리가 이미 말한다', () => {
    expect(
      renderToStaticMarkup(
        createElement(WalkTimesCurve, { hourly: [], goldenStart: null, goldenEnd: null }),
      ),
    ).toBe('')
  })
})

/**
 * 호출부가 스크롤 상태를 들고 있을 때 ([#730](https://github.com/8llow8llowMe/hondigagae/issues/730)).
 *
 * **훅이 만든 `rail` 로는 이것을 볼 수 없다** — node 환경에는 레이아웃이 없어 `fade` 가
 * 언제나 `none` 이고, 그러면 화살표는 어느 갈래에서도 안 그려져 단언이 공허해진다.
 * 그래서 `fade: 'both'` 인 `rail` 을 손으로 만들어 넘긴다.
 */
describe('WalkTimesCurve — 화살표는 레일을 넘긴 쪽이 그린다 (#730)', () => {
  const hoisted: ScrollRail & { ref: React.RefObject<HTMLUListElement | null> } = {
    ref: { current: null },
    fade: 'both',
    fadeClassName: '',
    onScroll: vi.fn(),
    page: vi.fn(),
  }

  it('rail 을 받으면 자기 화살표를 그리지 않는다 — 제목 줄로 올라갔다', () => {
    const markup = renderToStaticMarkup(
      createElement(WalkTimesCurve, {
        hourly: HOURLY,
        goldenStart: null,
        goldenEnd: null,
        rail: hoisted,
      }),
    )

    expect(markup).not.toContain(messages.home.goldenCurveNext)
    expect(markup).not.toContain(messages.home.goldenCurvePrev)
    // 레일 자신은 그대로다 — 넘침 차단막(`contain: layout`)이 여기 붙어 있다
    expect(markup).toContain('scroll-rail')
  })

  /**
   * **브리핑은 예전 그대로다** — 그 화면의 곡선은 제목 줄과 떨어져 있어 올릴 자리가 없다.
   * `rail` 을 넘기지 않으면 `ScrollRailArrows` 를 스스로 렌더한다. 서버 렌더의 `fade` 는
   * 언제나 `none` 이라 **그려진 화살표**로는 확인할 수 없어, 자기 훅을 쓰는지를 소스에서 본다.
   */
  it('rail 이 없으면 예전처럼 자기가 그린다', () => {
    const source = readFileSync(
      fileURLToPath(new URL('./walk-times-curve.tsx', import.meta.url)),
      'utf8',
    )

    expect(source).toContain('hoisted === undefined && (')
    expect(source).toContain('<ScrollRailArrows')
  })
})

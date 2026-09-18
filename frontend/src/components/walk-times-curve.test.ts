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

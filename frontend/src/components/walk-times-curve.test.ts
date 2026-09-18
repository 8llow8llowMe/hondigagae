import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

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

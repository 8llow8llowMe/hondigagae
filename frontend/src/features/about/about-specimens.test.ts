import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { VERDICT_SPECIMEN } from '@/features/about/about-specimen-data'
import { GoldenCurveSpecimen } from '@/features/about/golden-curve-specimen'
import { VerdictSpecimen } from '@/features/about/verdict-specimen'
import { messages } from '@/lib/messages'

/**
 * 고정 예시 4개 (#635, 명세 §6-4 2단). **끝 상태가 정본이다** — 정적 마크업에 최종값이 있고
 * 숨김 클래스가 없다. 재생은 마운트 뒤 클라이언트 몫이라 여기서는 보지 않는다.
 */
describe('VerdictSpecimen — 히어로 판정 카드', () => {
  const markup = renderToStaticMarkup(createElement(VerdictSpecimen))

  it('최종값이 처음부터 DOM 에 있다 — 29 · 56.0 · 31 · 위험', () => {
    expect(markup).toContain('>29<')
    expect(markup).toContain('>56.0<')
    expect(markup).toContain('>31<')
    expect(markup).toContain(messages.about.specimen.verdictGrade)
  })

  it('등급어는 metric-critical 로 칠한다 — 예시라도 실제 등급 자리다', () => {
    expect(markup).toContain('metric-critical')
  })

  it('노면 값에만 등급 색이 붙는다 — 기온·체감은 중립 수치다', () => {
    expect(markup.match(/text-metric-critical-500/g)?.length).toBe(1)
  })

  it('근거 문장이 치환돼 들어간다', () => {
    expect(markup).toContain(`${VERDICT_SPECIMEN.pavementThreshold}℃`)
    expect(markup).toContain(VERDICT_SPECIMEN.window)
    expect(markup).not.toContain('{threshold}')
    expect(markup).not.toContain('{window}')
  })

  it('예시 캡션이 있다 — 지금 제주 날씨로 읽히지 않게', () => {
    expect(markup).toContain(messages.about.specimen.verdictNote)
  })

  it('숨김 클래스가 없다', () => {
    expect(markup).not.toContain('opacity-0')
  })
})

describe('GoldenCurveSpecimen — 골든타임 곡선', () => {
  const markup = renderToStaticMarkup(createElement(GoldenCurveSpecimen))

  it('그래프는 role=img + 한 문장 라벨이다', () => {
    expect(markup).toContain('role="img"')
    expect(markup).toContain(messages.about.specimen.curveAria)
  })

  it('정적 렌더는 다 그려진 상태다 — dashoffset 0 · 숨김 없음', () => {
    expect(markup).toContain('stroke-dashoffset:0')
    expect(markup).not.toContain('stroke-dashoffset:1;')
    expect(markup).not.toContain('opacity-0')
  })

  it('선은 pathLength=1 위에서 그린다 — 없으면 1px 점선이 된다', () => {
    expect(markup).toContain('pathLength="1"')
  })

  it('노면 선만 등급 색이다 — 기온 선은 중립', () => {
    expect(markup).toContain('stroke-metric-critical-500')
    expect(markup).toContain('stroke-fg-muted')
  })

  it('추천 구간 면은 tint 층이다 — 글자를 얹지 않는 면', () => {
    expect(markup).toContain('fill-metric-high-100')
  })

  it('부제에 추천 구간이 치환돼 들어간다', () => {
    expect(markup).toContain(VERDICT_SPECIMEN.window)
    expect(markup).not.toContain('{window}')
  })

  it('봉우리 라벨은 판정 카드의 노면 값에서 파생된다', () => {
    expect(markup).toContain(`${VERDICT_SPECIMEN.pavement.toFixed(1)}℃`)
  })

  it('예시는 그림이라 y축 눈금을 두지 않는다', () => {
    expect(markup).not.toContain('50℃')
  })
})

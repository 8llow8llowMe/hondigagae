import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { MetricBadge, MetricValue } from '@/components/metric'

describe('MetricBadge', () => {
  it('tint 배경 위에는 -700 텍스트를 쓴다 (대비 4.5:1)', () => {
    const markup = renderToStaticMarkup(
      createElement(MetricBadge, { tone: 'high', children: '적합도 높음' }),
    )

    expect(markup).toContain('bg-metric-high-100')
    expect(markup).toContain('text-metric-high-700')
    expect(markup).not.toContain('text-metric-high-500')
  })

  it('unknown 에는 tint 를 주지 않고 점선 테두리만 쓴다', () => {
    const markup = renderToStaticMarkup(
      createElement(MetricBadge, { tone: 'unknown', children: '정보 없음' }),
    )

    expect(markup).toContain('border-dashed')
    expect(markup).not.toContain('bg-metric')
  })

  it('세로 바를 그리지 않는다 — 문구가 등급을 말한다', () => {
    const markup = renderToStaticMarkup(
      createElement(MetricBadge, { tone: 'mid', children: '적합도 보통' }),
    )

    expect(markup).not.toContain('border-l')
  })

  it('문구는 서버 값을 그대로 쓴다', () => {
    const markup = renderToStaticMarkup(
      createElement(MetricBadge, { tone: 'critical', children: '오늘은 산책을 피해주세요' }),
    )

    expect(markup).toContain('오늘은 산책을 피해주세요')
  })
})

describe('MetricValue', () => {
  it('숫자에 tabular-nums 를 강제한다', () => {
    const markup = renderToStaticMarkup(createElement(MetricValue, { value: '86', unit: '/100' }))

    expect(markup).toContain('tabular-nums')
  })

  it('단위를 값보다 작고 흐리게 붙인다', () => {
    const markup = renderToStaticMarkup(createElement(MetricValue, { value: '35.0', unit: '℃' }))

    expect(markup).toContain('℃')
    expect(markup).toContain('text-caption')
    expect(markup).toContain('text-fg-muted')
  })

  it('tone 이 없으면 중립이다 — 거리·개수에 등급 색을 쓰지 않는다', () => {
    const markup = renderToStaticMarkup(createElement(MetricValue, { value: '2.3', unit: 'km' }))

    expect(markup).toContain('text-fg')
    expect(markup).not.toContain('text-metric')
  })

  it('등급 색은 22px 이상 + weight 900 에만 붙는다', () => {
    const row = renderToStaticMarkup(createElement(MetricValue, { value: '86', tone: 'high' }))
    expect(row).toContain('text-title-1')
    expect(row).toContain('font-black')

    const hero = renderToStaticMarkup(
      createElement(MetricValue, { value: '86', tone: 'high', size: 'hero' }),
    )
    expect(hero).toContain('text-display')
    expect(hero).toContain('font-black')
  })
})

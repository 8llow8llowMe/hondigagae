import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { MetricBadge, MetricValue, MetricWord } from '@/components/metric'

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

describe('MetricBadge — 크기 (이슈 #68)', () => {
  it('sm 은 Badge size="sm" 과 같은 h-5 다 — 한 줄에 나란히 선다', () => {
    const markup = renderToStaticMarkup(
      createElement(MetricBadge, { tone: 'unknown', size: 'sm', children: '실내 여부 미확인' }),
    )

    expect(markup).toContain('h-5')
    expect(markup).not.toContain('py-1')
  })

  it('기본은 md 다', () => {
    const markup = renderToStaticMarkup(
      createElement(MetricBadge, { tone: 'high', children: '여행 적합' }),
    )

    expect(markup).toContain('py-1')
    expect(markup).not.toContain('h-5')
  })

  it('톤이 달라도 높이가 같다 — unknown 만 테두리가 있으면 그 배지만 2px 높다', () => {
    const high = renderToStaticMarkup(
      createElement(MetricBadge, { tone: 'high', children: '여행 적합' }),
    )
    const unknown = renderToStaticMarkup(
      createElement(MetricBadge, { tone: 'unknown', children: '판단 근거 부족' }),
    )

    // 투명 테두리로 자리를 미리 잡는다
    expect(high).toContain('border border-transparent')
    expect(unknown).toContain('border-dashed')
  })
})

describe('MetricWord — 판정 문장의 술어', () => {
  it('크기가 emphasis(20/800) 고정이다 — 호출부가 정하면 화면마다 갈린다', () => {
    const markup = renderToStaticMarkup(
      createElement(MetricWord, { tone: 'high', children: '여행 적합' }),
    )

    expect(markup).toContain('text-emphasis')
    expect(markup).toContain('font-extrabold')
    expect(markup).not.toContain('text-title-2')
  })

  it('흰 배경 위 단어라 -700 층을 쓴다 (-500 은 마크·큰 숫자 전용)', () => {
    const markup = renderToStaticMarkup(
      createElement(MetricWord, { tone: 'mid', children: '보통' }),
    )

    expect(markup).toContain('text-metric-mid-700')
    expect(markup).not.toContain('text-metric-mid-500')
  })

  it('unknown 에는 등급 색을 주지 않는다', () => {
    const markup = renderToStaticMarkup(
      createElement(MetricWord, { tone: 'unknown', children: '판단 근거 부족' }),
    )

    expect(markup).toContain('text-fg-muted')
    expect(markup).not.toContain('metric-unknown-500')
  })

  it('문구는 서버 값을 그대로 쓴다', () => {
    expect(
      renderToStaticMarkup(createElement(MetricWord, { tone: 'low', children: '주의 필요' })),
    ).toContain('주의 필요')
  })
})

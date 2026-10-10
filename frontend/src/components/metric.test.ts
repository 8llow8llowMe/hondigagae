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

/*
  같은 낱말이 두 축에 쓰인다 — 적합도 `MEDIUM` 도 `보통`, 혼잡도 `MODERATE` 도 `보통` 이다
  (#652 · 진단 G-1·D-2). 390 실측에서 두 배지의 문구·폭(38.74px)·tint·글자색이 전부 같았다.
*/
describe('MetricBadge — 축 라벨 (이슈 #652)', () => {
  it('axis 를 주지 않으면 접두어가 붙지 않는다', () => {
    const markup = renderToStaticMarkup(
      createElement(MetricBadge, { tone: 'mid', children: '보통' }),
    )

    expect(markup).not.toContain('font-medium')
    expect(markup).not.toContain('me-1')
    expect(markup).toContain('>보통</span>')
  })

  it('suitability 는 등급어 앞에 적합도를 세운다', () => {
    const markup = renderToStaticMarkup(
      createElement(MetricBadge, { tone: 'mid', axis: 'suitability', children: '보통' }),
    )

    expect(markup).toContain('>적합도 </span>')
    expect(markup).toContain('</span>보통</span>')
  })

  it('congestion 은 등급어 앞에 혼잡도를 세운다', () => {
    const markup = renderToStaticMarkup(
      createElement(MetricBadge, { tone: 'mid', axis: 'congestion', children: '보통' }),
    )

    expect(markup).toContain('>혼잡도 </span>')
    expect(markup).toContain('</span>보통</span>')
  })

  /*
    **접두어를 텍스트 노드로 이어 붙이지 않는다.** `{label} {children}` 로 쓰면 React 가
    하이드레이션 경계에 주석 노드를 끼워 실제 DOM 과 `renderToStaticMarkup` 문자열이
    갈린다 — `toContain('적합도 보통')` 이 테스트에서만 통과하는 false-green 이 된다.
    이 단언이 그 구현을 못 쓰게 막는다 (testing-guide.md §5).
  */
  it('접두어는 자기 span 이다 — 등급어와 한 문자열로 붙지 않는다', () => {
    const markup = renderToStaticMarkup(
      createElement(MetricBadge, { tone: 'mid', axis: 'suitability', children: '보통' }),
    )

    expect(markup).not.toContain('적합도 보통')
  })

  /* 라벨은 굵기만 한 단계 낮춘다 — 색·크기를 건드리면 tint 위 대비가 무너진다 (§2-3) */
  it('라벨에 등급 색이나 흐린 색을 따로 주지 않는다', () => {
    const markup = renderToStaticMarkup(
      createElement(MetricBadge, { tone: 'mid', axis: 'congestion', children: '보통' }),
    )

    expect(markup).toContain('<span class="me-1 font-medium">혼잡도 </span>')
  })

  /*
    **여백이 아니라 공백이어야 하는 이유.** 접근성 이름 계산은 인라인 노드를 이어 붙일 때
    공백을 넣어 주지 않는다 — `me-1` 로 간격을 주면 눈에는 `적합도 보통` 이지만 귀에는
    `적합도보통` 한 낱말이다(구현 전 실측: `textContent === '적합도보통'`). 태그를 걷어낸
    글자가 스크린리더가 읽는 것이다.
  */
  it('태그를 걷어내면 축과 등급 사이에 공백이 있다', () => {
    const markup = renderToStaticMarkup(
      createElement(MetricBadge, { tone: 'mid', axis: 'suitability', children: '보통' }),
    )

    expect(markup.replace(/<[^>]*>/g, '')).toBe('적합도 보통')
  })

  /* 축을 못 듣는 사용자가 생긴다 — 라벨을 aria 에서 숨기지 않는다 */
  it('라벨을 aria-hidden 으로 숨기지 않는다', () => {
    const markup = renderToStaticMarkup(
      createElement(MetricBadge, { tone: 'mid', axis: 'suitability', children: '보통' }),
    )

    expect(markup).not.toContain('aria-hidden')
  })

  /* 두 축이 한 화면에 서면 접두어가 실제로 둘을 가르는지 — 이것이 D-2 의 회귀 감시다 */
  it('같은 보통이라도 축이 다르면 다른 글자가 된다', () => {
    const suitability = renderToStaticMarkup(
      createElement(MetricBadge, { tone: 'mid', axis: 'suitability', children: '보통' }),
    )
    const congestion = renderToStaticMarkup(
      createElement(MetricBadge, { tone: 'mid', axis: 'congestion', children: '보통' }),
    )

    expect(suitability).not.toBe(congestion)
    expect(suitability).not.toContain('>혼잡도 </span>')
    expect(congestion).not.toContain('>적합도 </span>')
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
